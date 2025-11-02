#!/bin/bash

# Exit immediately if any command fails
set -e

# Colors for better readability
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# 1. Run build
echo -e "${YELLOW}Running build...${NC}"
npm run build

# 2. Rename the build folder to "remotion"
# Adjust "build" below if your actual build output folder has a different name
if [ -d "dist" ]; then
    echo -e "${YELLOW}Renaming 'build' to 'remotion'...${NC}"
    rm -rf remotion
    mv dist remotion
else
    echo -e "${RED}Error: 'build' folder not found. Check your build output.${NC}"
    exit 1
fi

# 3. Replace the "remotion" folder in another directory
# Change this path to your actual target directory
TARGET_DIR="/Users/naresh/Downloads/phd/my_repos/naresh-ub.github.io/book/_static"

if [ -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}Replacing existing 'remotion' in $TARGET_DIR...${NC}"
    rm -rf "$TARGET_DIR/remotion"
    cp -r remotion "$TARGET_DIR/"
    echo -e "${GREEN}Successfully replaced remotion in $TARGET_DIR${NC}"
else
    echo -e "${RED}Error: Target directory '$TARGET_DIR' not found.${NC}"
    exit 1
fi