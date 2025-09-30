# Usar una imagen oficial de Nginx como base
FROM nginx:stable

# Eliminar la configuración por defecto de Nginx para evitar conflictos
RUN rm /etc/nginx/conf.d/default.conf

# Copiar NUESTRO archivo de configuración al lugar correcto
# Esta línea es crucial.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el contenido de la carpeta 'build' al directorio web de Nginx
# (Usa 'dist' si tu proyecto usa Vite)
COPY dist /usr/share/nginx/html

# Exponer el puerto 80
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]