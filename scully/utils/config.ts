import {readFileSync} from 'fs';
import {jsonc} from 'jsonc';
import {join} from 'path';
import {findAngularJsonPath} from './findAngularJsonPath';
import {ScullyConfig} from './interfacesandenums';
import {logError, logWarn, yellow} from './log';
import {validateConfig} from './validateConfig';
import {compileConfig} from './compileConfig';
export const angularRoot = findAngularJsonPath();
export const scullyConfig: ScullyConfig = {} as ScullyConfig;

const loadIt = async () => {
  const compiledConfig = await compileConfig();
  let angularConfig = {} as any;
  let distFolder = join(angularRoot, './dist');
  try {
    angularConfig = jsonc.parse(readFileSync(join(angularRoot, 'angular.json')).toString());
    // TODO: make scully handle other projects as just the default one.
    const defaultProject = compiledConfig.projectName;
    distFolder = angularConfig.projects[defaultProject].architect.build.options.outputPath;
    if (distFolder.endsWith('dist') && !distFolder.includes('/')) {
      logError(
        `Your distribution files are in "${yellow(distFolder)}". Please change that to include a subfolder`
      );
      process.exit(15);
    }
  } catch (e) {
    logError(`Could not find project "${yellow(compiledConfig.projectName)}" in 'angular.json'.`);
    process.exit(15);
  }

  if (compiledConfig.hostUrl && compiledConfig.hostUrl.endsWith('/')) {
    compiledConfig.hostUrl = compiledConfig.hostUrl.substr(0, compiledConfig.hostUrl.length - 1);
  }
  // TODO: update types in interfacesandenums to force correct types in here.
  // tslint:disable-next-line: no-unused-expression
  Object.assign(
    scullyConfig,
    /** the default config */
    {
      homeFolder: angularRoot,
      outDir: join(angularRoot, './dist/static/'),
      distFolder,
      appPort: /** 1864 */ 'herodevs'.split('').reduce((sum, token) => (sum += token.charCodeAt(0)), 1000),
      staticport: /** 1668 */ 'scully'.split('').reduce((sum, token) => (sum += token.charCodeAt(0)), 1000),
      hostName: 'localhost',
      defaultPostRenderers: [],
    }
  ) as ScullyConfig;
  /** activate loaded config */
  await updateScullyConfig(compiledConfig);
  return scullyConfig;
};
export const loadConfig = loadIt();

export const updateScullyConfig = async (config: Partial<ScullyConfig>) => {
  /** note, an invalid config will abort the entire program. */
  const newConfig = Object.assign({}, scullyConfig, config);
  if (config.outDir === undefined) {
    logWarn(`The option outDir isn't configured, using default folder "${yellow(scullyConfig.outDir)}".`);
  } else {
    config.outDir = join(angularRoot, config.outDir);
  }
  const validatedConfig = await validateConfig(newConfig as ScullyConfig);
  if (validatedConfig) {
    const mergedRoutes = {...scullyConfig.routes, ...validatedConfig.routes};
    Object.assign(scullyConfig, config, {routes: mergedRoutes});
  }
};
