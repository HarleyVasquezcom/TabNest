# TabNest

A window-nesting (OneTab-style) tool for Chromium browsers (Manifest V3): one click stores every tab of the current window into a nest â€” title and URL â€” and closes the tabs so Chrome can release their memory. Restore one nest or all of them whenever you want.

Landing page: `https://tabnest-jade.vercel.app`

## What it does

- **Nest**: one click records every tab of the current window (title + URL), closes them, and stores a nest in `chrome.storage.local`.
- **Restore**: reopens all tabs of a nest; "Restore all" reopens every nest's tabs. Restoring removes the nest, OneTab-style.
- **Memory estimate**: each nest shows a deterministic estimate of saved memory (â‰ˆ12 MB per http(s) tab) â€” documented as an estimate, not a Chrome measurement.
- **Domain grouping**: each nest groups its saved pages by domain with counts.
- **Search + manage**: filter nests by name, tab title, URL or domain; delete one nest (two-step) or clear all; archive keeps the latest 40 nests.
- Internal pages (`chrome-extension://â€¦`) are never nested.

## Permissions â€” minimal and used

| Permission | Why |
| --- | --- |
| `storage` | nests + settings persisted in `chrome.storage.local` |
| `tabs` | reads the current window's tabs (title/URL) on nest, closes them, reopens them on restore |

No host permissions: page content is never read or modified.

## Install

1. Download `tabnest.zip` from the landing page and unpack it somewhere permanent.
2. Open `chrome://extensions`, enable Developer mode.
3. Click "Load unpacked" and pick the folder (keep the folder after loading).
4. Open the popup, nest a window, restore when you need the tabs back.

---

# TabNest (ES)

Un gestor de ventanas al estilo OneTab para navegadores Chromium (Manifest V3): un clic guarda cada pestaÃ±a de la ventana actual en un nido â€” tÃ­tulo y URL â€” y cierra las pestaÃ±as para que Chrome libere memoria. Restaura un nido o todos cuando quieras.

PÃ¡gina de aterrizaje: `https://tabnest-jade.vercel.app`

## QuÃ© hace

- **Encerrar**: un clic registra cada pestaÃ±a de la ventana actual (tÃ­tulo + URL), las cierra y guarda un nido en `chrome.storage.local`.
- **Restaurar**: reabre todas las pestaÃ±as de un nido; "Restaurar todo" reabre todas. Restaurar elimina el nido, al estilo OneTab.
- **EstimaciÃ³n de memoria**: cada nido muestra una estimaciÃ³n determinista de memoria liberada (â‰ˆ12 MB por pestaÃ±a http(s)) â€” documentada como estimaciÃ³n, no como mediciÃ³n de Chrome.
- **AgrupaciÃ³n por dominio**: cada nido agrupa sus pÃ¡ginas guardadas por dominio con recuentos.
- **BÃºsqueda y gestiÃ³n**: filtra nidos por nombre, tÃ­tulo de pestaÃ±a, URL o dominio; borra un nido (en dos pasos) o limpia todo; el archivo conserva los Ãºltimos 40 nidos.
- Las pÃ¡ginas internas (`chrome-extension://â€¦`) nunca se encierran.

## Permisos â€” mÃ­nimos y usados

| Permiso | Por quÃ© |
| --- | --- |
| `storage` | nidos + ajustes persistidos en `chrome.storage.local` |
| `tabs` | lee las pestaÃ±as de la ventana actual (tÃ­tulo/URL) al encerrar, las cierra y las reabre al restaurar |

Sin permisos de host: el contenido de las pÃ¡ginas nunca se lee ni modifica.

## InstalaciÃ³n

1. Descarga `tabnest.zip` desde la pÃ¡gina de aterrizaje y descomprÃ­melo en un lugar permanente.
2. Abre `chrome://extensions` y activa el modo desarrollador.
3. Haz clic en "Cargar descomprimida" y elige la carpeta (consÃ©rvala despuÃ©s de cargarla).
4. Abre el popup, encierra una ventana y restaura cuando necesites las pestaÃ±as de vuelta.

---

Built by Harley VÃ¡squez â€” https://www.linkedin.com/in/harleyvasquez/
