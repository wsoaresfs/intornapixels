#!/usr/bin/env python3
from pathlib import Path
import shutil, re, sys

root=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
need=[root/'app/index.html',root/'app/bootstrap-cloud.js',root/'shared/cloud.js',root/'sw.js']
missing=[str(p) for p in need if not p.exists()]
if missing:
    raise SystemExit('Arquivos-base não encontrados: '+', '.join(missing))
here=Path(__file__).resolve().parent
shutil.copy2(here/'shared/cloud-rc11-patch.js',root/'shared/cloud-rc11-patch.js')
shutil.copy2(here/'app/features-v11.js',root/'app/features-v11.js')
shutil.copy2(here/'app/features-v11.css',root/'app/features-v11.css')

# 1) cloud delta-sync patch must load after cloud.js and before bootstrap-cloud.js
p=root/'app/index.html';s=p.read_text(encoding='utf-8')
if '/shared/cloud-rc11-patch.js' not in s:
    s=s.replace('<script src="/shared/cloud.js"></script>','<script src="/shared/cloud.js"></script><script src="/shared/cloud-rc11-patch.js"></script>')
s=s.replace('Cloud v6 • dados protegidos e sincronizados.','RC11 • nuvem protegida e sincronização segura.')
s=s.replace('Intorná Pixels — área operacional online com Supabase.','Intorná Pixels — RC11 • Operação, IA, WhatsApp e Performance.')
p.write_text(s,encoding='utf-8')

# 2) load the already deployed but previously orphaned WhatsApp Cloud API module + RC11 Marketing
p=root/'app/bootstrap-cloud.js';s=p.read_text(encoding='utf-8')
anchor="const v6=document.createElement('script');v6.src='features-v6.js';v6.async=false;document.body.appendChild(v6);"
addition=anchor+"\n      const v7=document.createElement('script');v7.src='features-v7.js';v7.async=false;document.body.appendChild(v7);\n      const v11=document.createElement('script');v11.src='features-v11.js';v11.async=false;document.body.appendChild(v11);"
if "v11.src='features-v11.js'" not in s:
    if anchor not in s: raise SystemExit('Não encontrei o ponto de carregamento features-v6.js em bootstrap-cloud.js')
    s=s.replace(anchor,addition)
p.write_text(s,encoding='utf-8')

# 3) PWA cache invalidation + new assets
p=root/'sw.js';s=p.read_text(encoding='utf-8')
s=re.sub(r"const CACHE='[^']+'", "const CACHE='intorna-pixels-rc11-auditoria'", s, count=1)
assets=['/shared/cloud-rc11-patch.js','/app/features-v11.js','/app/features-v11.css']
for asset in assets:
    if asset not in s:
        # append safely to the first assets array if present
        m=re.search(r'(const\s+ASSETS\s*=\s*\[)(.*?)(\];)',s,re.S)
        if m:
            body=m.group(2).rstrip()
            comma='' if not body.strip() else ('' if body.rstrip().endswith(',') else ',')
            body=body+comma+f"\n  '{asset}'"
            s=s[:m.start(2)]+body+s[m.end(2):]
p.write_text(s,encoding='utf-8')

print('RC11 aplicada ao fonte local:',root)
print('Revise com git diff antes de commit/deploy.')
