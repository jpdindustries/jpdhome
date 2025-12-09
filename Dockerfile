FROM httpd:alpine

# Copy all static files to Apache htdocs directory
COPY . /usr/local/apache2/htdocs/

# Set proper ownership and permissions for www-data user
RUN chown -R www-data:www-data /usr/local/apache2/htdocs/ && chmod -R 755 /usr/local/apache2/htdocs/

# Expose port 80
EXPOSE 80

# Start httpd
CMD ["httpd-foreground"]