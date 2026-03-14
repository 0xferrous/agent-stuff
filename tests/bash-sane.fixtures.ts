export type PathFixture = {
	name: string;
	input: string;
	expected: string[][];
};

export type RawFixture = {
	name: string;
	input: string;
	expectedReason: RegExp;
};

export const pathFixtures: PathFixture[] = [
	{
		name: "journalctl unit with paging flags",
		input: "journalctl -u sshd -n 100 --no-pager",
		expected: [["journalctl"]],
	},
	{
		name: "journalctl xeu form",
		input: "journalctl -xeu tailscaled.service",
		expected: [["journalctl"]],
	},
	{
		name: "journalctl since and grep pipeline source command",
		input: "journalctl --since today -u docker.service",
		expected: [["journalctl"]],
	},
	{
		name: "systemctl restart with sudo wrapper skipped",
		input: "sudo systemctl restart tailscaled.service",
		expected: [["systemctl", "restart", "tailscaled.service"]],
	},
	{
		name: "systemctl user scoped command",
		input: "systemctl --user status pipewire.service",
		expected: [["systemctl", "status", "pipewire.service"]],
	},
	{
		name: "systemctl user scoped command requested example",
		input: "systemctl --user status wispd.service",
		expected: [["systemctl", "status", "wispd.service"]],
	},
	{
		name: "systemctl list-units stops at option",
		input: "systemctl list-units --type=service --state=running",
		expected: [["systemctl", "list-units"]],
	},
	{
		name: "gh repo clone with passthrough args",
		input: "gh repo clone owner/repo -- --depth=1",
		expected: [["gh", "repo", "clone", "owner/repo"]],
	},
	{
		name: "gh global repo option before subcommand",
		input: "gh --repo owner/repo pr status",
		expected: [["gh", "pr", "status"]],
	},
	{
		name: "gh pr checkout",
		input: "gh pr checkout 123",
		expected: [["gh", "pr", "checkout", "123"]],
	},
	{
		name: "gh repo sync with branch",
		input: "gh repo sync cli/cli -b trunk",
		expected: [["gh", "repo", "sync", "cli/cli"]],
	},
	{
		name: "gh api stops at option boundary",
		input: "gh api repos/owner/repo/pulls --paginate",
		expected: [["gh", "api", "repos/owner/repo/pulls"]],
	},
	{
		name: "git remote add",
		input: "git remote add origin git@github.com:foo/bar.git",
		expected: [["git", "remote", "add", "origin", "git@github.com:foo/bar.git"]],
	},
	{
		name: "git global option before subcommand",
		input: "git -C /tmp/myrepo status",
		expected: [["git", "status"]],
	},
	{
		name: "git worktree add",
		input: "git worktree add ../repo-fix origin/main",
		expected: [["git", "worktree", "add", "../repo-fix", "origin/main"]],
	},
	{
		name: "git rebase interactive stops at option",
		input: "git rebase -i HEAD~3",
		expected: [["git", "rebase"]],
	},
	{
		name: "git commit stops at option",
		input: "git commit -m 'hello world'",
		expected: [["git", "commit"]],
	},
	{
		name: "git config nested command path",
		input: "git config --global user.name dmnt",
		expected: [["git", "config"]],
	},
	{
		name: "nix shell stops at option boundary",
		input: "nix shell nixpkgs#jq nixpkgs#fd -c jq . package.json",
		expected: [["nix", "shell", "nixpkgs#jq", "nixpkgs#fd"]],
	},
	{
		name: "nix global option before subcommand",
		input: "nix --extra-experimental-features 'nix-command flakes' build .#hello",
		expected: [["nix", "build", ".#hello"]],
	},
	{
		name: "nix run with flake app",
		input: "nix run nixpkgs#hello -- --greeting hi",
		expected: [["nix", "run", "nixpkgs#hello"]],
	},
	{
		name: "nix develop with command",
		input: "nix develop .#ci -c cargo test --workspace",
		expected: [["nix", "develop", ".#ci"]],
	},
	{
		name: "nix build flake attr",
		input: "nix build .#packages.x86_64-linux.default",
		expected: [["nix", "build", ".#packages.x86_64-linux.default"]],
	},
	{
		name: "nix flake update specific input",
		input: "nix flake lock --update-input nixpkgs",
		expected: [["nix", "flake", "lock"]],
	},
	{
		name: "nix profile install package",
		input: "nix profile install nixpkgs#ripgrep",
		expected: [["nix", "profile", "install", "nixpkgs#ripgrep"]],
	},
	{
		name: "nix-store delete stops at option boundary",
		input: "nix-store --delete /nix/store/abcd-package",
		expected: [["nix-store"]],
	},
	{
		name: "env wrapper skipped",
		input: "env FOO=1 BAR=2 cargo test --workspace",
		expected: [["cargo", "test"]],
	},
	{
		name: "time wrapper skipped",
		input: "time git fetch --all",
		expected: [["git", "fetch"]],
	},
	{
		name: "multiple wrappers skipped",
		input: "command nohup sudo systemctl restart nginx",
		expected: [["systemctl", "restart", "nginx"]],
	},
	{
		name: "pipeline extracts all commands",
		input: "journalctl -u sshd | rg error",
		expected: [["journalctl"], ["rg", "error"]],
	},
	{
		name: "chained commands extract all commands",
		input: "git status && gh pr status && systemctl status sshd",
		expected: [["git", "status"], ["gh", "pr", "status"], ["systemctl", "status", "sshd"]],
	},
	{
		name: "subshell extracts nested command",
		input: "(cd /tmp && nix build .#foo)",
		expected: [["nix", "build", ".#foo"]],
	},
	{
		name: "safe builtins ignored while external command remains",
		input: "cd /tmp && pwd && git status",
		expected: [["git", "status"]],
	},
	{
		name: "source builtin is supervised",
		input: "source ./deploy.env",
		expected: [["source", "./deploy.env"]],
	},
];

export const rawFixtures: RawFixture[] = [
	{
		name: "for loop with variable expansion",
		input: "for x in *; do echo $x; done",
		expectedReason: /unsupported|non-literal/i,
	},
	{
		name: "arithmetic command expression",
		input: "(( i++ )) && git status",
		expectedReason: /unsupported|non-literal/i,
	},
	{
		name: "command substitution in argument",
		input: "git show $(git rev-parse HEAD)",
		expectedReason: /unsupported|non-literal/i,
	},
];
