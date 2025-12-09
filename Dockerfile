FROM nginx:alpine

# Copy all static files to nginx html directory
COPY . /usr/share/nginx/html/

# Set proper ownership and permissions for nginx user
RUN chown -R nginx:nginx /usr/share/nginx/html/ && chmod -R 755 /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]