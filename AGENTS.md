# Engineering rules

- Type webhook payloads and narrow caught errors without disabling strict checks, so compilation catches malformed assumptions.
- Keep edge functions self-contained when adding transport types, because external deployment does not upload shared subdirectories.