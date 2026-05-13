# Download CLI and Desktop Packages

## CLI

macOS Apple silicon:

```bash
mkdir -p ~/.local/superset-cli
curl -L https://github.com/crystalphantom/superset/releases/download/cli-latest/superset-darwin-arm64.tar.gz | tar -xz -C ~/.local/superset-cli
~/.local/superset-cli/bin/superset --version
```

Ubuntu x64:

```bash
mkdir -p ~/.local/superset-cli
curl -L https://github.com/crystalphantom/superset/releases/download/cli-latest/superset-linux-x64.tar.gz | tar -xz -C ~/.local/superset-cli
~/.local/superset-cli/bin/superset --version
```

## Desktop

macOS Apple silicon:

```bash
curl -L -o ~/Downloads/Superset-arm64.dmg https://github.com/crystalphantom/superset/releases/download/desktop-v1.8.11/Superset-arm64.dmg
open ~/Downloads/Superset-arm64.dmg
```

macOS Intel:

```bash
curl -L -o ~/Downloads/Superset-x64.dmg https://github.com/crystalphantom/superset/releases/download/desktop-v1.8.11/Superset-x64.dmg
open ~/Downloads/Superset-x64.dmg
```

Ubuntu x64:

```bash
curl -L -o ~/Downloads/Superset-x86_64.AppImage https://github.com/crystalphantom/superset/releases/download/desktop-v1.8.11/Superset-x86_64.AppImage
chmod +x ~/Downloads/Superset-x86_64.AppImage
~/Downloads/Superset-x86_64.AppImage
```
