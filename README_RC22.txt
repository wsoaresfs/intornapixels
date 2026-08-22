INTORNÁ PIXELS — RC22 MEGA • IDENTITY LOCK V3

OBJETIVO
Impedir que uma referência tecnicamente melhorada altere as características reais do cliente.

NOVO FLUXO OBRIGATÓRIO
Fotos originais -> candidato melhorado -> comparação lado a lado -> aprovação humana ->
1 foto-teste -> aprovação humana -> lote restante -> revisão -> galeria.

PRINCIPAIS MUDANÇAS
1. Candidato não é Referência Ideal automaticamente
   - geração automática e importação entram como pending_review
   - as fotos originais continuam preservadas durante a análise
   - jobs da RC21 com referência ainda não aprovada entram na mesma comparação

2. Checklist de identidade
   - mesmo rosto e traços
   - mesmo físico e proporções
   - mesma idade aparente
   - mesmo tom de pele
   - mesmo cabelo
   - sem embelezamento ou harmonização

3. Prompt conservador V3
   - melhoria somente técnica
   - preserva dentes e aparelho, sinais, rugas e assimetrias
   - proíbe roupa/cenário/personagem inventado na etapa de referência
   - não permite adivinhar detalhes ausentes

4. Foto-teste obrigatória
   - o primeiro envio aceita somente 1 imagem
   - o job fica bloqueado em revisão
   - lote só é liberado após cinco confirmações de identidade
   - teste rejeitado pode ser substituído no mesmo slot

5. Flow Bridge RC22
   - separa candidato, foto-teste e lote liberado
   - um cliente por contexto
   - aviso de links expirados
   - abre referências e copia prompt
   - não armazena senha, API key ou service role

ORDEM DE PUBLICAÇÃO
1. Aplicar backend/migrations/rc22_identity_lock_v3.sql pelo fluxo oficial do projeto.
2. Publicar backend/production-identity/index.ts na função production-identity com JWT obrigatório.
3. Publicar backend/production-external/index.ts na função production-external com JWT obrigatório.
4. Enviar os arquivos listados em UPLOAD_LIST_RC22.txt para o GitHub.
5. Aguardar o deploy Vercel ficar READY e fazer Ctrl+F5.
6. Remover a extensão RC21 e instalar IntornaFlowBridge-RC22.zip.

IMPORTANTE
- Não apague features-v19.js, features-v20.js ou features-v21.js.
- Não exponha SUPABASE_SECRET_KEY/SERVICE_ROLE no frontend ou na extensão.
- A configuração Leaked Password Protection continua sendo feita no painel do Supabase Auth.

