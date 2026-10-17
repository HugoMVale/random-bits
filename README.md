# Random Bits

Source for [Random Bits](https://hugomvale.github.io/random-bits/), a personal science blog.

There's no fixed topic or scope beyond STEM — posts cover whatever random thought or curiosity comes to mind (physics, math, chemistry, etc.), often with some interactive visualization or small simulation attached.

## Stack

- Built with [Hugo](https://gohugo.io/) using the [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme.
- Posts live under `content/posts/`.
- Interactive figures/demos are plain JS in `static/js/`.
- JavaScript is linted with [oxlint](https://oxc.rs/docs/guide/usage/linter.html) and formatted with [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html).

The `pyproject.toml` is unrelated to the site itself; it's just a scratch environment used to generate some figures for the posts.

## Local development

```sh
npm install
npm run lint
npm run format:check
hugo server
```

Run `npm run format` to format the authored JavaScript and `package.json`.
