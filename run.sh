#!/bin/bash

# exit on error
# set -e

ROOT_DIR=$(pwd)

# check if imagemagick is installed
if ! command -v magick &>/dev/null; then
    echo "imagemagick could not be found"
    exit 1
fi

# check if node is installed
if ! command -v node &>/dev/null; then
    echo "node could not be found"
    exit 1
fi

# check if resvg is installed
if ! command -v resvg &>/dev/null; then
    echo "resvg could not be found"
    exit 1
fi

# check if pngquant is installed
if ! command -v pngquant &>/dev/null; then
    echo "pngquant could not be found"
    exit 1
fi

# check if oxipng is installed
if ! command -v oxipng &>/dev/null; then
    echo "oxipng could not be found"
    exit 1
fi

# check if optipng is installed
if ! command -v optipng &>/dev/null; then
    echo "optipng could not be found"
    exit 1
fi

# check if zopflipng is installed
if ! command -v npx zopflipng &>/dev/null; then
    echo "zopflipng could not be found"
    exit 1
fi

# check if pngout is installed
if ! command -v npx pngout &>/dev/null; then
    echo "pngout could not be found"
    exit 1
fi

generate_image() {
    local width=$1
    local snapToGrid=$2
    local colors="${3:-24}"

    mkdir -p "$ROOT_DIR/docs/latest/w${width}"

    npm run generate -- --width "$width" --snap-to-grid "$snapToGrid"
    resvg \
        --width "$width" \
        --image-rendering high-quality \
        "$ROOT_DIR/docs/latest/signalwerk.svg" \
        "$ROOT_DIR/docs/latest/w${width}/signalwerk-resvg.png"

    magick \
        "$ROOT_DIR/docs/latest/w${width}/signalwerk-resvg.png" \
        -dither None \
        -colors "$colors" \
        "$ROOT_DIR/docs/latest/w${width}/signalwerk-resvg-indexed.png"

    pngquant \
        --quality=100 \
        --force \
        --nofs \
        --output "$ROOT_DIR/docs/latest/w${width}/signalwerk-opt.png" \
        "$ROOT_DIR/docs/latest/w${width}/signalwerk-resvg-indexed.png"
    oxipng \
        --opt max \
        --strip all \
        "$ROOT_DIR/docs/latest/w${width}/signalwerk-opt.png"
    optipng -o7 -zm1-9 "$ROOT_DIR/docs/latest/w${width}/signalwerk-opt.png"
    npx zopflipng -y --filters=0me "$ROOT_DIR/docs/latest/w${width}/signalwerk-opt.png" "$ROOT_DIR/docs/latest/w${width}/signalwerk-zopflipng.png"
    npx pngout "$ROOT_DIR/docs/latest/w${width}/signalwerk-zopflipng.png" "$ROOT_DIR/docs/latest/w${width}/signalwerk-pngout.png" -y

    # clean up
    rm "$ROOT_DIR/docs/latest/w${width}/signalwerk-resvg.png"
    rm "$ROOT_DIR/docs/latest/w${width}/signalwerk-resvg-indexed.png"
    rm "$ROOT_DIR/docs/latest/w${width}/signalwerk-opt.png"

    # is signalwerk-pngout.png or signalwerk-zopflipng.png smaller in filesize? delete the other and rename the remaining to signalwerk.png
    if [ "$(stat -c%s "$ROOT_DIR/docs/latest/w${width}/signalwerk-pngout.png")" -lt "$(stat -c%s "$ROOT_DIR/docs/latest/w${width}/signalwerk-zopflipng.png")" ]; then
        rm "$ROOT_DIR/docs/latest/w${width}/signalwerk-zopflipng.png"
        mv "$ROOT_DIR/docs/latest/w${width}/signalwerk-pngout.png" "$ROOT_DIR/docs/latest/w${width}/signalwerk.png"
    else
        rm "$ROOT_DIR/docs/latest/w${width}/signalwerk-pngout.png"
        mv "$ROOT_DIR/docs/latest/w${width}/signalwerk-zopflipng.png" "$ROOT_DIR/docs/latest/w${width}/signalwerk.png"
    fi

}

# only for favicon.ico with 16 colors
generate_image 16 true 16
generate_image 24 true 16
generate_image 32 true 16
generate_image 64 true 16

# Generate images at different sizes with snapping to grid
generate_image 192 true
generate_image 256 true
generate_image 512 true
generate_image 1000 true
generate_image 2000 true

# create favicon.ico
magick convert \
    "$ROOT_DIR/docs/latest/w16/signalwerk.png" \
    "$ROOT_DIR/docs/latest/w24/signalwerk.png" \
    "$ROOT_DIR/docs/latest/w32/signalwerk.png" \
    "$ROOT_DIR/docs/latest/w64/signalwerk.png" \
    "$ROOT_DIR/docs/latest/w256/signalwerk.png" \
    "$ROOT_DIR/docs/favicon.ico"

identify "$ROOT_DIR/docs/favicon.ico"

# delete the small images only used for favicon.ico
rm -rf "$ROOT_DIR/docs/latest/w16"
rm -rf "$ROOT_DIR/docs/latest/w24"
rm -rf "$ROOT_DIR/docs/latest/w32"
rm -rf "$ROOT_DIR/docs/latest/w64"

# generate the svg version without snapping to grid
npm run generate -- --width 2000

# magick compare $ROOT_DIR/docs/latest/w2000/signalwerk-old.png $ROOT_DIR/docs/latest/w2000/signalwerk.png -compose src $ROOT_DIR/docs/latest/w2000/diff.png
