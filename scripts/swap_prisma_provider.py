import os
url = os.environ.get("DATABASE_URL", "")
path = "prisma/schema.prisma"
c = open(path).read()
if url.startswith("postgresql") or url.startswith("postgres"):
    c = c.replace('provider = "sqlite"', 'provider = "postgresql"')
    print("[swap] provider -> postgresql")
else:
    print("[swap] provider -> sqlite (dev)")
open(path, "w").write(c)
