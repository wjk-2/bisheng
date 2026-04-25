import { atomWithLocalStorage } from './utils';

const defaultLang = (): string => 'zh-Hans';

const lang = atomWithLocalStorage('lang', defaultLang());

export default { lang };
