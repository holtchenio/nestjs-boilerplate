---
inject: true
to: src/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/persistence/prisma/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository.ts
after: \<creating\-property\-payload \/\>
skip_if: <%= property %>:
---
<% if (kind === 'primitive' || kind === 'denormalized') { -%>
        <%= property %>: data.<%= property %>,
<% } -%>
