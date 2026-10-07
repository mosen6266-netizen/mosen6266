#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, hashlib, io, json, os, zipfile
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

AAD=b"signal-scheduler-update-v1"

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--public-key', required=True)
    ap.add_argument('--source-dir', required=True)
    ap.add_argument('--version', required=True)
    ap.add_argument('--build', required=True)
    ap.add_argument('--file', action='append', dest='files', required=True)
    ap.add_argument('--output', required=True)
    ns=ap.parse_args()
    src=Path(ns.source_dir).resolve()
    files=[]
    for rel in ns.files:
        rel=rel.replace('\\','/').lstrip('/')
        p=(src/rel).resolve()
        if not str(p).startswith(str(src)+os.sep) or not p.is_file():
            raise SystemExit(f"invalid file: {rel}")
        files.append(rel)
    bio=io.BytesIO()
    with zipfile.ZipFile(bio,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        z.writestr('package.json',json.dumps({
            'format':'signal-scheduler-update-payload-v1',
            'version':ns.version,
            'build':ns.build,
            'files':files
        },ensure_ascii=False,indent=2))
        for rel in files:
            z.write(src/rel,arcname=rel)
    plain=bio.getvalue()
    aes_key=os.urandom(32)
    nonce=os.urandom(12)
    ciphertext=AESGCM(aes_key).encrypt(nonce,plain,AAD)
    pub=serialization.load_pem_public_key(Path(ns.public_key).read_bytes())
    ek=pub.encrypt(aes_key,padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    ))
    obj={
        'format':'signal-scheduler-update-envelope-v1',
        'aad':AAD.decode(),
        'encrypted_key':base64.b64encode(ek).decode(),
        'nonce':base64.b64encode(nonce).decode(),
        'ciphertext':base64.b64encode(ciphertext).decode()
    }
    out=Path(ns.output)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(obj,separators=(',',':')),'utf-8')
    print(json.dumps({
        'output':str(out),
        'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
        'encrypted_bytes':out.stat().st_size,
        'payload_bytes':len(plain),
        'build':ns.build,
        'files':files
    },ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
