# Runtime Prerequisites for Cross-Runtime Helper E2E

The helper E2E suite requires these tools to be installed and available on `PATH`:

- `java`
- `javac`
- `python3` (or `python`)
- `go`
- `rustc`
- `php`
- `dotnet`

Run only the helper E2E suite with:

```bash
npm run test:helpers:e2e
```

## Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y openjdk-21-jdk golang-go php-cli python3 rustc
```

Install .NET SDK (example: 8.0):

```bash
wget https://dot.net/v1/dotnet-install.sh -O /tmp/dotnet-install.sh
bash /tmp/dotnet-install.sh --channel 8.0 --install-dir "$HOME/.dotnet"
export PATH="$HOME/.dotnet:$PATH"
```

To persist `dotnet` on `PATH`:

```bash
echo 'export PATH="$HOME/.dotnet:$PATH"' >> ~/.zshrc
```

## macOS (Homebrew)

```bash
brew install openjdk go python rust php dotnet
```

## Windows (winget, PowerShell)

```powershell
winget install Microsoft.OpenJDK.21
winget install GoLang.Go
winget install Python.Python.3
winget install Rustlang.Rustup
winget install PHP.PHP
winget install Microsoft.DotNet.SDK.8
```

## Verify Installs

```bash
java -version
javac -version
python3 --version
go version
rustc --version
php -v
dotnet --version
```
