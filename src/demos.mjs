import { build } from 'vite';import path from 'node:path';import {ROOT} from './common.mjs';
export async function buildDemos(stage){for(const framework of ['react','vue'])await build({root:path.join(ROOT,'demos',framework),base:'./',logLevel:'error',build:{outDir:path.join(stage,'demos',framework),emptyOutDir:true}});}
