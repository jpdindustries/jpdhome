FROM httpd:alpine

# Install git for submodule handling
RUN apk add --no-cache git

# Copy all static files to Apache htdocs directory
COPY . /usr/local/apache2/htdocs/

# Initialize and update git submodules, then checkout webgl branch for webgl submodule
RUN cd /usr/local/apache2/htdocs && \
    git submodule update --init --recursive && \
    cd webgl && \
    git checkout webgl

# Set proper ownership and permissions for www-data user
RUN chown -R www-data:www-data /usr/local/apache2/htdocs/ && chmod -R 755 /usr/local/apache2/htdocs/

# Expose port 80
EXPOSE 80

# Start httpd
CMD ["httpd-foreground"]