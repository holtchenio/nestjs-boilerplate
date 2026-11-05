---
inject: true
to: prisma/schema.prisma
append: true
skip_if: model <%= name %>
---

model <%= name %> {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)

  @@map("<%= h.inflection.tableize(name) %>")
}
