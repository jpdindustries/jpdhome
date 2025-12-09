# Multi-stage build to handle submodules
FROM alpine:latest AS builder

# Install git and other necessary tools if needed
RUN apk add --no-cache git

# Clone the main repository and all submodules
# The submodules are checked out to the commit recorded in the 'main' branch's index.
RUN git clone --recursive -b multi https://github.com/jpdindustries/jpdhome.git /app

# Ensure correct permissions for the cloned content
RUN chmod -R 755 /app

# --- Final Stage: Nginx Web Server ---
FROM nginx:alpine

# Copy the entire cloned application from the builder stage 
# to Nginx's default document root directory.
COPY --from=builder /app /usr/share/nginx/html

# Nginx already runs as a non-root user (nginx) and is configured 
# to serve files from this location. No chown/chmod is typically needed here.

EXPOSE 80

# Nginx's default CMD is already set in the base image, but can be specified:
# CMD ["nginx", "-g", "daemon off;"]