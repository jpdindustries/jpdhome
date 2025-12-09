# Multi-stage build to handle submodules
FROM alpine:latest AS builder

RUN apk add --no-cache git

RUN git clone --recursive -b main https://github.com/jpdindustries/jpdhome.git /app

FROM httpd:alpine

COPY --from=builder /app /usr/local/apache2/htdocs/

RUN chown -R www-data:www-data /usr/local/apache2/htdocs/ && chmod -R 755 /usr/local/apache2/htdocs/

EXPOSE 80

CMD ["httpd-foreground"]