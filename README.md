# apps-script → Next.js

Scaffold inicial para migrar el proyecto Apps Script a Next.js con TypeScript, Tailwind y Prisma (Postgres).

Rápido inicio local:

1. Copia el ejemplo de env:

```bash
cp .env.example .env
```

2. Instala dependencias:

```bash
npm install
```

3. Ejecuta Postgres + app con docker-compose (opcional):

```bash
docker compose up -d
```

4. Genera cliente Prisma y aplica migración inicial:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

5. Arranca en desarrollo:

```bash
npm run dev
```

Siguientes pasos recomendados:
- Mapear controladores en `src/controllers` a `pages/api/*`.
- Implementar modelos en `prisma/schema.prisma` según `models/` existentes.
- Portar servicios (Gmail, Telegram) a módulos server-side y mover secretos a `env`.
