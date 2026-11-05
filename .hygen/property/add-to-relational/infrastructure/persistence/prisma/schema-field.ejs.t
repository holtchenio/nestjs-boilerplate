---
inject: true
to: prisma/schema.prisma
after: model <%= name %> {
skip_if: <%= property %>
---
<% if (kind === 'primitive') { -%>
  <%= property %> <% if (type === 'string') { -%>String<% } else if (type === 'number') { -%>Int<% } else if (type === 'boolean') { -%>Boolean<% } else if (type === 'Date') { -%>DateTime<% } -%><% if (isOptional || isNullable) { -%>?<% } -%>
<% } else if (kind === 'denormalized') { -%>
  <%= property %> Json<% if (isOptional || isNullable) { -%>?<% } -%>
<% } -%>
