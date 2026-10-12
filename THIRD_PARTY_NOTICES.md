# Third-party software notices / 第三方软件声明

JSON Atlas combines the MIT-licensed project code with third-party packages. The package versions below are the direct dependencies resolved by the checked-in `package-lock.json`; transitive and platform-specific optional packages are also listed in that lockfile. License terms belong to their respective authors and are not replaced by the project's MIT license.

JSON Atlas 项目代码以 MIT 许可证发布，同时依赖以下第三方软件。表中版本为仓库 `package-lock.json` 当前锁定的直接依赖版本；传递依赖和平台可选依赖也记录在锁文件中。第三方软件仍受各自许可证约束，不因本项目使用 MIT 许可证而改变。

## Direct dependencies / 直接依赖

| Package                  | Resolved version | License      | Upstream                                                             |
| ------------------------ | ---------------: | ------------ | -------------------------------------------------------------------- |
| `@codemirror/commands`   |           6.11.1 | MIT          | [CodeMirror](https://github.com/codemirror/commands)                 |
| `@codemirror/lang-json`  |            6.0.2 | MIT          | [CodeMirror](https://github.com/codemirror/lang-json)                |
| `@codemirror/lang-yaml`  |            6.1.3 | MIT          | [CodeMirror](https://github.com/codemirror/lang-yaml)                |
| `@codemirror/state`      |            6.7.6 | MIT          | [CodeMirror](https://github.com/codemirror/state)                    |
| `@codemirror/view`       |          6.43.14 | MIT          | [CodeMirror](https://github.com/codemirror/view)                     |
| `@xyflow/react`          |          12.12.0 | MIT          | [xyflow](https://github.com/xyflow/xyflow)                           |
| `codemirror`             |            6.0.2 | MIT          | [CodeMirror](https://github.com/codemirror/basic-setup)              |
| `lossless-json`          |            4.3.1 | MIT          | [lossless-json](https://github.com/josdejong/lossless-json)          |
| `papaparse`              |            5.7.0 | MIT          | [Papa Parse](https://github.com/mholt/PapaParse)                     |
| `react`                  |           19.3.0 | MIT          | [React](https://github.com/facebook/react)                           |
| `react-dom`              |           19.3.0 | MIT          | [React](https://github.com/facebook/react)                           |
| `smol-toml`              |            1.9.1 | BSD-3-Clause | [smol-toml](https://github.com/squirrelchat/smol-toml)               |
| `tabulator-tables`       |            6.6.1 | MIT          | [Tabulator](https://github.com/tabulator-tables/tabulator)           |
| `vanilla-jsoneditor`     |           3.13.0 | ISC          | [vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor) |
| `yaml`                   |            2.9.1 | ISC          | [yaml](https://github.com/eemeli/yaml)                               |
| `prettier` (development) |           3.9.10 | MIT          | [Prettier](https://github.com/prettier/prettier)                     |
| `vite` (development)     |            6.4.4 | MIT          | [Vite](https://github.com/vitejs/vite)                               |

## License texts / 许可证文本

Each dependency publishes its applicable license text in its upstream repository and npm package. The lockfile pins the exact package tarballs used to build this project. When redistributing a built bundle, retain this notice and comply with each bundled package's license, including applicable copyright and license-text requirements.

各依赖会在其上游仓库及 npm 包中提供适用的许可证文本。锁文件固定了构建本项目所用的精确依赖版本。重新分发构建产物时，请保留本声明，并遵守被打包依赖的许可要求，包括适用的版权声明和许可证文本要求。
