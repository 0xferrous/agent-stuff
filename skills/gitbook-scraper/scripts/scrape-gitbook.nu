#!/usr/bin/env nix-shell
#! nix-shell -i nu -p nushell curl pandoc python3 coreutils

def main [
  gitbook_base_url: string,
  output_dir: string,
  max_pages: int = 500
] {
  let base_url = ($gitbook_base_url | str trim --right --char '/')
  let out_dir = $output_dir

  for cmd in [curl pandoc python3] {
    if ((which $cmd | length) == 0) {
      error make {
        msg: $"Missing required command: ($cmd)"
      }
    }
  }

  mkdir $out_dir

  let tmp_dir = (^mktemp -d | str trim)
  let sitemap_url = $"($base_url)/sitemap.xml"
  let sitemap_file = [$tmp_dir sitemap.xml] | path join
  let urls_file = [$tmp_dir urls.txt] | path join

  print $"==> Fetching sitemap: ($sitemap_url)"
  let sitemap_fetch = (^curl -fsSL $sitemap_url -o $sitemap_file | complete)
  if $sitemap_fetch.exit_code != 0 {
    ^rm -rf $tmp_dir
    error make { msg: $"Failed to fetch sitemap: ($sitemap_url)" }
  }

  let parse_sitemap_py = r#'
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

sitemap_path, base_url, out_path, max_pages = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
base = urllib.parse.urlparse(base_url)

ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

seen_sitemaps = set()
seen_urls = set()
urls = []


def normalize(u: str) -> str:
    return u.strip().rstrip('/')


def same_site(u: str) -> bool:
    p = urllib.parse.urlparse(u)
    return p.scheme in ("http", "https") and p.netloc == base.netloc


def add_url(u: str):
    if len(urls) >= max_pages:
        return
    u = normalize(u)
    if not u or not same_site(u):
        return
    if u in seen_urls:
        return
    seen_urls.add(u)
    urls.append(u)


def parse_xml_bytes(data: bytes):
    return ET.fromstring(data)


def fetch_xml(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; gitbook-scraper/1.0)"})
    with urllib.request.urlopen(req) as resp:
        return parse_xml_bytes(resp.read())


def parse_sitemap_root(root):
    tag = root.tag.lower()

    # <urlset>
    if tag.endswith('urlset'):
        for loc in root.findall('.//sm:url/sm:loc', ns):
            if loc.text:
                add_url(loc.text)
                if len(urls) >= max_pages:
                    return
        # Fallback if namespace handling fails
        for loc in root.findall('.//loc'):
            if loc.text:
                add_url(loc.text)
                if len(urls) >= max_pages:
                    return
        return

    # <sitemapindex>
    if tag.endswith('sitemapindex'):
        child_sitemaps = []
        for loc in root.findall('.//sm:sitemap/sm:loc', ns):
            if loc.text:
                child_sitemaps.append(loc.text.strip())
        if not child_sitemaps:
            for loc in root.findall('.//loc'):
                if loc.text:
                    child_sitemaps.append(loc.text.strip())

        for sm_url in child_sitemaps:
            sm_url = normalize(sm_url)
            if not sm_url or sm_url in seen_sitemaps:
                continue
            if not same_site(sm_url):
                continue
            seen_sitemaps.add(sm_url)
            try:
                child_root = fetch_xml(sm_url)
            except Exception:
                continue
            parse_sitemap_root(child_root)
            if len(urls) >= max_pages:
                return


def parse_local_file(path: str):
    root = ET.parse(path).getroot()
    parse_sitemap_root(root)


parse_local_file(sitemap_path)

with open(out_path, 'w', encoding='utf-8') as f:
    for u in urls[:max_pages]:
        f.write(u + '\n')
'#

  let parse_result = (^python3 -c $parse_sitemap_py $sitemap_file $base_url $urls_file ($max_pages | into string) | complete)
  if $parse_result.exit_code != 0 {
    ^rm -rf $tmp_dir
    error make { msg: "Failed to parse sitemap" }
  }

  let urls = (open $urls_file | lines | where {|u| $u != ""})
  let total = ($urls | length)
  print $"==> Found ($total) pages in sitemap"

  let summary_file = [$out_dir SUMMARY.md] | path join
  [
    "# GitBook Export"
    ""
    $"Source: ($base_url)"
    ""
  ] | str join (char nl) | save -f $summary_file

  let page_path_py = r#'
import sys
import urllib.parse

url = sys.argv[1]
p = urllib.parse.urlparse(url)
path = p.path.strip('/')
if not path:
    print('index')
else:
    print(path)
'#

  let markdown_url_py = r#'
import sys
import urllib.parse

base_url, page_url = sys.argv[1], sys.argv[2]
b = urllib.parse.urlparse(base_url)
p = urllib.parse.urlparse(page_url)

base_path = b.path.rstrip('/')
page_path = p.path.rstrip('/')

if page_path == base_path:
    print(base_url + '/readme.md')
else:
    print(page_url + '.md')
'#

  let extract_main_py = r#'
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
html = open(src, 'r', encoding='utf-8', errors='ignore').read()
match = re.search(r'<main\b[^>]*>(.*?)</main>', html, flags=re.IGNORECASE|re.DOTALL)
if match:
    open(dst, 'w', encoding='utf-8').write(match.group(1))
    sys.exit(0)
sys.exit(1)
'#

  mut index = 0
  for url in $urls {
    $index = $index + 1
    print $"[($index)/($total)] ($url)"

    let page_path = (^python3 -c $page_path_py $url | str trim)
    let out_file = [$out_dir $"($page_path).md"] | path join
    mkdir ($out_file | path dirname)

    let markdown_url = (^python3 -c $markdown_url_py $base_url $url | str trim)
    let md_fetch = (^curl -A "Mozilla/5.0 (compatible; gitbook-scraper/1.0)" -fsSL $markdown_url -o $out_file | complete)

    if $md_fetch.exit_code != 0 {
      let html_file = [$tmp_dir page.html] | path join
      let fragment_file = [$tmp_dir fragment.html] | path join

      let page_fetch = (^curl -A "Mozilla/5.0 (compatible; gitbook-scraper/1.0)" -fsSL $url -o $html_file | complete)
      if $page_fetch.exit_code != 0 {
        print -e $"Warning: failed to fetch ($url)"
        continue
      }

      let extract_result = (^python3 -c $extract_main_py $html_file $fragment_file | complete)
      if $extract_result.exit_code == 0 {
        let convert_result = (^pandoc -f html -t gfm --wrap=none $fragment_file -o $out_file | complete)
        if $convert_result.exit_code != 0 {
          ^rm -rf $tmp_dir
          error make { msg: $"pandoc conversion failed for ($url)" }
        }
      } else {
        let convert_result = (^pandoc -f html -t gfm --wrap=none $html_file -o $out_file | complete)
        if $convert_result.exit_code != 0 {
          ^rm -rf $tmp_dir
          error make { msg: $"pandoc conversion failed for ($url)" }
        }
      }
    }

    let rel = ($out_file | str replace --all $"($out_dir)/" "")
    let title = ($page_path | path basename)
    let summary_line = (["- [" $title "](" $rel ")" (char nl)] | str join "")
    $summary_line | save --append $summary_file
  }

  ^rm -rf $tmp_dir
  print $"==> Done. Markdown files written to: ($out_dir)"
  print $"==> Index written to: ($summary_file)"
}
