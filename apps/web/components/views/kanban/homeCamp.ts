import { loadCampHome } from '@buxa/server/composers/index.server';

/** The camp facts for the home page, loaded on the server. Routes reach composers through the screens layer. */
export const loadHomeCamp = () => loadCampHome();
