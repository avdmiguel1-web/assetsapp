# Integracion de Almacenamiento en Nube

## Soporte actual
- OneDrive / SharePoint: enlaces publicos y enlaces privados mediante Microsoft Graph.
- Dropbox: enlaces compartidos publicos con vista previa y descarga.

## Variables de entorno en Vercel
Configura estas variables solo en el servidor:

```text
MS_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MS_CLIENT_SECRET=tu-secreto-de-azure
```

## Azure: configuracion minima para OneDrive / SharePoint
1. Crea una App Registration en Azure.
2. Genera un Client Secret.
3. Agrega permisos de aplicacion en Microsoft Graph:
   - `Files.Read.All`
   - `Sites.Read.All`
4. Otorga `Admin consent`.
5. Copia `Tenant ID`, `Client ID` y `Client Secret` a Vercel.
6. Redeploya la app.

## Como funciona
- La app detecta enlaces de OneDrive / SharePoint y los resuelve desde `/api/remote-file`.
- Si hay credenciales de Microsoft Graph, el servidor descarga el archivo usando la API oficial y lo sirve dentro de la app.
- Los enlaces de Dropbox se normalizan a enlaces directos para vista previa y descarga.

## Limitaciones
- Carpetas compartidas no tienen vista previa embebida; se debe compartir el archivo directamente.
- Para otros proveedores se puede extender la misma arquitectura de resolutores por proveedor.
