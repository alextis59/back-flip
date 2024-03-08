FROM node:18.19-alpine3.19

# Add bash to run wait-for-it script
RUN apk update && apk add bash
# Graphics Magicks
RUN apk add --no-cache gettext librsvg ghostscript graphicsmagick

ARG NPM_GITLAB_TOKEN
ENV NPM_GITLAB_TOKEN=$NPM_GITLAB_TOKEN

# Copy list of server side dependencies
COPY package.json /app/package.json
# Ensure build reproducibility:
# see https://docs.npmjs.com/configuring-npm/package-lock-json.html
COPY package-lock.json /app/package-lock.json

# Use /app working directory
WORKDIR /app

# Install dependencies with build reproducibility
RUN npm ci

ARG VERSION
ENV VERSION=$VERSION

# Copy src files
COPY . /app/