# v1.0.1-webdeploy

Correccion del primer despliegue en Netlify: se reemplaza ngx-toastr (peer Angular 21) por notificaciones propias compatibles con Angular 22. Instalacion limpia de dependencias sin force ni legacy-peer-deps, build de produccion y 27 pruebas frontend aprobados.

# v1.0.0-webdeploy

Proyecto completo preparado para frontend en Netlify, API y Socket.IO en Render y PostgreSQL en Supabase.

- Configuracion de hosting, HTTPS, CORS, Google OAuth y fallback Angular `/* /index.html 200`.
- Migraciones 001–007: normalizacion de recorridos, aprobacion administrativa de choferes, estadisticas y reservas/ubicacion de invitados.
- Consulta y reserva sin cuenta, comprobante privado, pago en efectivo y cancelacion atomica.
- Ubicacion opcional de invitados, mapa privado del chofer y retiro al cerrar la reserva.
- Sin Mercado Pago. Sin secretos, bases locales, fixtures, node_modules ni builds publicados en el arbol de esta version.

Ver DEPLOY_SUPABASE_RENDER.md para las variables y el orden de provisionamiento. Este tag publica codigo preparado; no acredita un despliegue remoto activo.
