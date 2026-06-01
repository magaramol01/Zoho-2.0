#!/bin/bash
set -e

APP_NAME="Zoho Power Grid"
APP_FILE="Zoho Power Grid-0.1.0.AppImage"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPIMAGE_SRC="$SCRIPT_DIR/dist/$APP_FILE"
INSTALL_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"

echo "========================================="
echo "  Installing $APP_NAME on Ubuntu"
echo "========================================="

# Create required directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_DIR"

# Copy AppImage to local bin
echo "[1/4] Copying AppImage to $INSTALL_DIR ..."
cp "$APPIMAGE_SRC" "$INSTALL_DIR/$APP_FILE"
chmod +x "$INSTALL_DIR/$APP_FILE"

# Extract icon if AppImage has one, otherwise use a placeholder
echo "[2/4] Setting up icon ..."
# Try to extract icon from AppImage
cd /tmp
"$INSTALL_DIR/$APP_FILE" --appimage-extract usr/share/icons 2>/dev/null || true
"$INSTALL_DIR/$APP_FILE" --appimage-extract *.png 2>/dev/null || true

ICON_PATH=""
if ls /tmp/squashfs-root/*.png 2>/dev/null; then
  cp /tmp/squashfs-root/*.png "$ICON_DIR/zoho-power-grid.png" 2>/dev/null && ICON_PATH="$ICON_DIR/zoho-power-grid.png"
fi
rm -rf /tmp/squashfs-root

# Use a generic icon name if extraction failed
[ -z "$ICON_PATH" ] && ICON_PATH="utilities-system-monitor"

# Create .desktop launcher
echo "[3/4] Creating application launcher ..."
cat > "$DESKTOP_DIR/zoho-power-grid.desktop" << DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Zoho Power Grid
GenericName=Zoho Sprints Power Grid
Comment=Zoho Sprints Power Grid Desktop Application
Exec="$INSTALL_DIR/$APP_FILE" %U
Icon=$ICON_PATH
Terminal=false
StartupWMClass=zoho-power-grid
Categories=Office;ProjectManagement;
MimeType=
Keywords=zoho;sprints;grid;project;management;
StartupNotify=true
DESKTOP

chmod +x "$DESKTOP_DIR/zoho-power-grid.desktop"

# Update desktop database
echo "[4/4] Refreshing application menu ..."
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
xdg-desktop-menu install --novendor "$DESKTOP_DIR/zoho-power-grid.desktop" 2>/dev/null || true

echo ""
echo "✅ Installation complete!"
echo ""
echo "You can now:"
echo "  1. Search for 'Zoho Power Grid' in your application menu"
echo "  2. Or run it directly: \"$INSTALL_DIR/$APP_FILE\""
echo ""
