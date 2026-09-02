/**
 * Insignias del perfil.
 *
 * Los iconos son SVG propios, no emoji: un emoji lo dibuja cada sistema a su
 * manera y no hereda el color del tema. Estos usan `currentColor`, así que
 * la rareza y el acento del perfil los tiñen solos.
 */

export type BadgeRarity = 'common' | 'rare' | 'legendary';

/** El color con el que se tine cada rareza, y su nombre. */
export const COLOR_RAREZA: Record<BadgeRarity, string> = {
  legendary: '#F5A524',
  rare: '#A855F7',
  common: '#7A8CA6',
};
export const NOMBRE_RAREZA: Record<BadgeRarity, string> = {
  legendary: 'Legendaria',
  rare: 'Rara',
  common: 'Comun',
};

/**
 * De dónde sale una insignia. Es lo que decide si hoy puede concederse.
 *
 *  · perfil   — se calcula con lo que ya sabemos del perfil. Funciona ya.
 *  · servidor — la concede el equipo; vive en `insignias_concedidas`.
 *  · plan     — depende de un cobro que todavía no existe.
 *  · externo  — necesita otra integración (Discord, dominios propios).
 *
 * Ninguna se guarda en el perfil. Ese era justo el problema: `badges` era un
 * campo editable, así que cualquiera podía ponerse «Staff» o «Verificado».
 */
export type FuenteInsignia = 'perfil' | 'servidor' | 'plan' | 'externo';

/** Lo que hay que alcanzar, para las que se calculan solas. */
export interface MetaInsignia {
  /** Qué se mide. `lib/insignias.ts` sabe sacar cada uno. */
  campo: 'dias' | 'vistas' | 'notas';
  valor: number;
  /** Singular, para escribir «te faltan 84 visitas». */
  unidad: string;
  unidadPlural: string;
  /** Nota media minima. La cantidad sola no basta para algunas. */
  minMedia?: number;
}

export interface Badge {
  /** SVG en línea. Constante local, nunca contenido de usuario. */
  icon: string;
  label: string;
  rare: BadgeRarity;
  /** Condición de desbloqueo, en lenguaje llano */
  how: string;
  fuente: FuenteInsignia;
  /** Sólo las de fuente 'perfil' la tienen. */
  meta?: MetaInsignia;
}

export const BADGES: Record<string, Badge> = {
  staff: {
    label: "Staff",
    rare: 'legendary',
    how: "Miembro del equipo de IDENTITY.",
    fuente: 'servidor',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"2.3 2 19.39 20\"><path fill=\"currentColor\" d=\"m16.06 13.09l5.63 5.59l-3.32 3.28l-5.59-5.59v-.92l2.36-2.36h.92m.91-2.53L16 9.6l-4.79 4.8v1.97L5.58 22L2.3 18.68l5.59-5.59h1.97l.78-.78L6.8 8.46H5.5L2.69 5.62L5.31 3l2.8 2.8v1.31L12 10.95l2.66-2.66l-.96-1.01L15 5.97h-2.66l-.65-.65L15 2l.66.66v2.66L16.97 4l3.28 3.28c1.09 1.1 1.09 2.89 0 3.98l-1.97-2.01l-1.31 1.31Z\"></path></svg>",
  },
  helper: {
    label: "Helper",
    rare: 'common',
    how: "Ayudar a la comunidad de forma constante.",
    fuente: 'servidor',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"5 2 14 20\"><path fill=\"currentColor\" d=\"M10 18q-.825 0-1.412-.587T8 16v-1.25q-1.425-.975-2.212-2.5T5 9q0-2.925 2.038-4.962T12 2t4.963 2.038T19 9q0 1.725-.788 3.238T16 14.75V16q0 .825-.587 1.413T14 18zm0 4q-.425 0-.712-.288T9 21v-1h6v1q0 .425-.288.713T14 22z\"></path></svg>",
  },
  premium: {
    label: "Premium",
    rare: 'rare',
    how: "Tener plan PRO o CREATOR activo.",
    fuente: 'plan',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"23 32 465 448\"><path fill=\"currentColor\" d=\"M396.31 32H264l84.19 112.26L396.31 32zm-280.62 0l48.12 112.26L248 32H115.69zM256 74.67L192 160h128l-64-85.33zm166.95-23.61L376.26 160H488L422.95 51.06zm-333.9 0L23 160h112.74L89.05 51.06zM146.68 192H24l222.8 288h.53L146.68 192zm218.64 0L264.67 480h.53L488 192H365.32zm-35.93 0H182.61L256 400l73.39-208z\"></path></svg>",
  },
  verified: {
    label: "Verificado",
    rare: 'rare',
    how: "Verificar la identidad con una red enlazada.",
    fuente: 'servidor',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"1 1.5 22 21\"><path fill=\"currentColor\" d=\"m8.6 22.5l-1.9-3.2l-3.6-.8l.35-3.7L1 12l2.45-2.8l-.35-3.7l3.6-.8l1.9-3.2L12 2.95l3.4-1.45l1.9 3.2l3.6.8l-.35 3.7L23 12l-2.45 2.8l.35 3.7l-3.6.8l-1.9 3.2l-3.4-1.45l-3.4 1.45Zm2.35-6.95L16.6 9.9l-1.4-1.45l-4.25 4.25l-2.15-2.1L7.4 12l3.55 3.55Z\"></path></svg>",
  },
  donar: {
    label: "Donante",
    rare: 'rare',
    how: "Apoyar el proyecto con una donación.",
    fuente: 'plan',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"2.01 2.01 19.98 19.98\"><path d=\"M2.047 14.668a.994.994 0 0 0 .465.607l1.91 1.104v2.199a1 1 0 0 0 1 1h2.199l1.104 1.91a1.01 1.01 0 0 0 .866.5c.174 0 .347-.046.501-.135L12 20.75l1.91 1.104a1.001 1.001 0 0 0 1.366-.365l1.103-1.91h2.199a1 1 0 0 0 1-1V16.38l1.91-1.104a1 1 0 0 0 .365-1.367L20.75 12l1.104-1.908a1 1 0 0 0-.365-1.366l-1.91-1.104v-2.2a1 1 0 0 0-1-1H16.38l-1.103-1.909a1.008 1.008 0 0 0-.607-.466a.993.993 0 0 0-.759.1L12 3.25l-1.909-1.104a1 1 0 0 0-1.366.365l-1.104 1.91H5.422a1 1 0 0 0-1 1V7.62l-1.91 1.104a1.003 1.003 0 0 0-.365 1.368L3.251 12l-1.104 1.908a1.009 1.009 0 0 0-.1.76zM12 13c-3.48 0-4-1.879-4-3c0-1.287 1.029-2.583 3-2.915V6.012h2v1.109c1.734.41 2.4 1.853 2.4 2.879h-1l-1 .018C13.386 9.638 13.185 9 12 9c-1.299 0-2 .515-2 1c0 .374 0 1 2 1c3.48 0 4 1.879 4 3c0 1.287-1.029 2.583-3 2.915V18h-2v-1.08c-2.339-.367-3-2.003-3-2.92h2c.011.143.159 1 2 1c1.38 0 2-.585 2-1c0-.325 0-1-2-1z\" fill=\"currentColor\"></path></svg>",
  },
  gifter: {
    label: "Gifter",
    rare: 'rare',
    how: "Regalar un plan a otra persona.",
    fuente: 'plan',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"2 2 16 16\"><g fill=\"currentColor\"><path fill-rule=\"evenodd\" d=\"M14 6a2.5 2.5 0 0 0-4-3a2.5 2.5 0 0 0-4 3H3.25C2.56 6 2 6.56 2 7.25v.5C2 8.44 2.56 9 3.25 9h6V6h1.5v3h6C17.44 9 18 8.44 18 7.75v-.5C18 6.56 17.44 6 16.75 6zm-1-1.5a1 1 0 0 1-1 1h-1v-1a1 1 0 1 1 2 0m-6 0a1 1 0 0 0 1 1h1v-1a1 1 0 0 0-2 0\" clip-rule=\"evenodd\"></path><path d=\"M9.25 10.5H3v4.75A2.75 2.75 0 0 0 5.75 18h3.5zm1.5 7.5v-7.5H17v4.75A2.75 2.75 0 0 1 14.25 18z\"></path></g></svg>",
  },
  star: {
    label: "Estrella",
    rare: 'rare',
    how: "Perfil destacado por el equipo.",
    fuente: 'servidor',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"2 2 20 20\"><path fill=\"currentColor\" d=\"M9.153 5.408C10.42 3.136 11.053 2 12 2c.947 0 1.58 1.136 2.847 3.408l.328.588c.36.646.54.969.82 1.182c.28.213.63.292 1.33.45l.636.144c2.46.557 3.689.835 3.982 1.776c.292.94-.546 1.921-2.223 3.882l-.434.507c-.476.557-.715.836-.822 1.18c-.107.345-.071.717.001 1.46l.066.677c.253 2.617.38 3.925-.386 4.506c-.766.582-1.918.051-4.22-1.009l-.597-.274c-.654-.302-.981-.452-1.328-.452c-.347 0-.674.15-1.329.452l-.595.274c-2.303 1.06-3.455 1.59-4.22 1.01c-.767-.582-.64-1.89-.387-4.507l.066-.676c.072-.744.108-1.116 0-1.46c-.106-.345-.345-.624-.821-1.18l-.434-.508c-1.677-1.96-2.515-2.941-2.223-3.882c.293-.941 1.523-1.22 3.983-1.776l.636-.144c.699-.158 1.048-.237 1.329-.45c.28-.213.46-.536.82-1.182l.328-.588Z\"></path></svg>",
  },
  legend: {
    label: "Domain Legend",
    rare: 'legendary',
    how: "Enlazar un dominio propio al perfil.",
    fuente: 'externo',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"2.18 2.38 19.77 19.77\"><path fill=\"currentColor\" d=\"m2.45 10.575l4.2-4.2q.35-.35.825-.5t.975-.05l1.3.275Q8.4 7.7 7.625 9t-1.5 3.15zm5.125 2.275q.575-1.8 1.563-3.4t2.387-3q2.2-2.2 5.025-3.287t5.275-.663q.425 2.45-.65 5.275T17.9 12.8q-1.375 1.375-3 2.388t-3.425 1.587zm6.9-3q.575.575 1.413.575T17.3 9.85t.575-1.412t-.575-1.413t-1.412-.575t-1.413.575t-.575 1.413t.575 1.412m-.7 12.025l-1.6-3.675q1.85-.725 3.163-1.5t2.912-2.125l.25 1.3q.1.5-.05.988t-.5.837zM4.05 16.05q.875-.875 2.125-.888t2.125.863t.875 2.125t-.875 2.125q-.625.625-2.087 1.075t-4.038.8q.35-2.575.8-4.025T4.05 16.05\"></path></svg>",
  },
  og: {
    label: "OG",
    rare: 'legendary',
    how: "Cuenta con más de un año de antigüedad.",
    fuente: 'perfil',
    meta: { campo: 'dias', valor: 365, unidad: 'día', unidadPlural: 'días' },
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"4.39 2 15.22 20.97\"><path fill=\"currentColor\" d=\"m12 8.5l2.116 5.088l5.492.44l-4.184 3.585l1.278 5.36L12 20.1l-4.702 2.872l1.278-5.36l-4.184-3.584l5.492-.44L12 8.5ZM8 2v9H6V2h2Zm10 0v9h-2V2h2Zm-5 0v5h-2V2h2Z\"></path></svg>",
  },
  booster: {
    label: "Server Booster",
    rare: 'rare',
    how: "Mejorar el servidor de Discord de la comunidad.",
    fuente: 'externo',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"4.99 3 14 18\"><path fill=\"currentColor\" d=\"M17.66 11.2c-.23-.3-.51-.56-.77-.82c-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32c-2.59 2.08-3.61 5.75-2.39 8.9c.04.1.08.2.08.33c0 .22-.15.42-.35.5c-.23.1-.47.04-.66-.12a.58.58 0 0 1-.14-.17c-1.13-1.43-1.31-3.48-.55-5.12C5.78 10 4.87 12.3 5 14.47c.06.5.12 1 .29 1.5c.14.6.41 1.2.71 1.73c1.08 1.73 2.95 2.97 4.96 3.22c2.14.27 4.43-.12 6.07-1.6c1.83-1.66 2.47-4.32 1.53-6.6l-.13-.26c-.21-.46-.77-1.26-.77-1.26m-3.16 6.3c-.28.24-.74.5-1.1.6c-1.12.4-2.24-.16-2.9-.82c1.19-.28 1.9-1.16 2.11-2.05c.17-.8-.15-1.46-.28-2.23c-.12-.74-.1-1.37.17-2.06c.19.38.39.76.63 1.06c.77 1 1.98 1.44 2.24 2.8c.04.14.06.28.06.43c.03.82-.33 1.72-.93 2.27Z\"></path></svg>",
  },
  bughunter: {
    label: "Bug Hunter",
    rare: 'rare',
    how: "Reportar un fallo que llegue a corregirse.",
    fuente: 'servidor',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"4 3.41 16 17.59\"><path fill=\"currentColor\" d=\"M19 8h-1.81a5.985 5.985 0 0 0-1.82-1.96l.93-.93a.996.996 0 1 0-1.41-1.41l-1.47 1.47C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L9.11 3.7A.996.996 0 1 0 7.7 5.11l.92.93C7.88 6.55 7.26 7.22 6.81 8H5c-.55 0-1 .45-1 1s.45 1 1 1h1.09c-.05.33-.09.66-.09 1v1H5c-.55 0-1 .45-1 1s.45 1 1 1h1v1c0 .34.04.67.09 1H5c-.55 0-1 .45-1 1s.45 1 1 1h1.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H19c.55 0 1-.45 1-1s-.45-1-1-1h-1.09c.05-.33.09-.66.09-1v-1h1c.55 0 1-.45 1-1s-.45-1-1-1h-1v-1c0-.34-.04-.67-.09-1H19c.55 0 1-.45 1-1s-.45-1-1-1m-6 8h-2c-.55 0-1-.45-1-1s.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1m0-4h-2c-.55 0-1-.45-1-1s.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1\"></path></svg>",
  },
  winner: {
    label: "Winner",
    rare: 'legendary',
    how: "Ganar un concurso de perfiles.",
    fuente: 'servidor',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"2 2 20 20.75\"><g fill=\"currentColor\"><path d=\"M22 8.162v.073c0 .86 0 1.291-.207 1.643c-.207.352-.584.561-1.336.98l-.793.44c.546-1.848.729-3.834.796-5.532l.01-.221l.002-.052c.651.226 1.017.395 1.245.711c.283.393.283.915.283 1.958Zm-20 0v.073c0 .86 0 1.291.207 1.643c.207.352.584.561 1.336.98l.794.44c-.547-1.848-.73-3.834-.797-5.532l-.01-.221l-.001-.052c-.652.226-1.018.395-1.246.711C2 6.597 2 7.12 2 8.162Z\"></path><path fill-rule=\"evenodd\" d=\"M16.377 2.347A26.373 26.373 0 0 0 12 2c-1.783 0-3.253.157-4.377.347c-1.139.192-1.708.288-2.184.874c-.475.586-.45 1.219-.4 2.485c.173 4.348 1.111 9.78 6.211 10.26V19.5H9.82a1 1 0 0 0-.98.804l-.19.946H6a.75.75 0 0 0 0 1.5h12a.75.75 0 0 0 0-1.5h-2.65l-.19-.946a1 1 0 0 0-.98-.804h-1.43v-3.534c5.1-.48 6.039-5.911 6.211-10.26c.05-1.266.076-1.9-.4-2.485c-.476-.586-1.045-.682-2.184-.874Zm-3.59 3.46a.75.75 0 0 1 .463.693v4a.75.75 0 0 1-1.5 0V8.31l-.22.22a.75.75 0 1 1-1.06-1.06l1.5-1.5a.75.75 0 0 1 .817-.163Z\" clip-rule=\"evenodd\"></path></g></svg>",
  },
  second: {
    label: "Segundo puesto",
    rare: 'rare',
    how: "Quedar segundo en un concurso de perfiles.",
    fuente: 'servidor',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"5 2 14 20\"><g fill=\"currentColor\"><path fill-rule=\"evenodd\" d=\"M12 16a7 7 0 1 0 0-14a7 7 0 0 0 0 14Zm0-10c-.284 0-.474.34-.854 1.023l-.098.176c-.108.194-.162.29-.246.354c-.085.064-.19.088-.4.135l-.19.044c-.738.167-1.107.25-1.195.532c-.088.283.164.577.667 1.165l.13.152c.143.167.215.25.247.354c.032.104.021.215 0 .438l-.02.203c-.076.785-.114 1.178.115 1.352c.23.174.576.015 1.267-.303l.178-.082c.197-.09.295-.135.399-.135c.104 0 .202.045.399.135l.178.082c.691.319 1.037.477 1.267.303c.23-.174.191-.567.115-1.352l-.02-.203c-.021-.223-.032-.334 0-.438c.032-.103.104-.187.247-.354l.13-.152c.503-.588.755-.882.667-1.165c-.088-.282-.457-.365-1.195-.532l-.19-.044c-.21-.047-.315-.07-.4-.135c-.084-.064-.138-.16-.246-.354l-.098-.176C12.474 6.34 12.284 6 12 6Z\" clip-rule=\"evenodd\"></path><path d=\"m7.093 15.941l-.379 1.382c-.628 2.292-.942 3.438-.523 4.065c.147.22.344.396.573.513c.652.332 1.66-.193 3.675-1.243c.67-.35 1.006-.524 1.362-.562a1.87 1.87 0 0 1 .398 0c.356.038.691.213 1.362.562c2.015 1.05 3.023 1.575 3.675 1.243c.229-.117.426-.293.573-.513c.42-.627.105-1.773-.523-4.065l-.379-1.382A8.461 8.461 0 0 1 12 17.5a8.46 8.46 0 0 1-4.907-1.559Z\"></path></g></svg>",
  },
  third: {
    label: "Tercer puesto",
    rare: 'rare',
    how: "Quedar tercero en un concurso de perfiles.",
    fuente: 'servidor',
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"5 2 14 20\"><g fill=\"currentColor\"><path fill-rule=\"evenodd\" d=\"M12 16a7 7 0 1 0 0-14a7 7 0 0 0 0 14Zm0-10c-.284 0-.474.34-.854 1.023l-.098.176c-.108.194-.162.29-.246.354c-.085.064-.19.088-.4.135l-.19.044c-.738.167-1.107.25-1.195.532c-.088.283.164.577.667 1.165l.13.152c.143.167.215.25.247.354c.032.104.021.215 0 .438l-.02.203c-.076.785-.114 1.178.115 1.352c.23.174.576.015 1.267-.303l.178-.082c.197-.09.295-.135.399-.135c.104 0 .202.045.399.135l.178.082c.691.319 1.037.477 1.267.303c.23-.174.191-.567.115-1.352l-.02-.203c-.021-.223-.032-.334 0-.438c.032-.103.104-.187.247-.354l.13-.152c.503-.588.755-.882.667-1.165c-.088-.282-.457-.365-1.195-.532l-.19-.044c-.21-.047-.315-.07-.4-.135c-.084-.064-.138-.16-.246-.354l-.098-.176C12.474 6.34 12.284 6 12 6Z\" clip-rule=\"evenodd\"></path><path d=\"m7.093 15.941l-.379 1.382c-.628 2.292-.942 3.438-.523 4.065c.147.22.344.396.573.513c.652.332 1.66-.193 3.675-1.243c.67-.35 1.006-.524 1.362-.562a1.87 1.87 0 0 1 .398 0c.356.038.691.213 1.362.562c2.015 1.05 3.023 1.575 3.675 1.243c.229-.117.426-.293.573-.513c.42-.627.105-1.773-.523-4.065l-.379-1.382A8.461 8.461 0 0 1 12 17.5a8.46 8.46 0 0 1-4.907-1.559Z\"></path></g></svg>",
  },
  veterano: {
    label: "Veterano",
    rare: 'common',
    how: "Tres meses con el perfil en pie.",
    fuente: 'perfil',
    meta: { campo: 'dias', valor: 90, unidad: 'día', unidadPlural: 'días' },
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M12 3 3 9v3l9-6 9 6V9zm0 6-9 6v3l9-6 9 6v-3z\"></path></svg>",
  },
  popular: {
    label: "Popular",
    rare: 'rare',
    how: "Quinientas visitas distintas al perfil.",
    fuente: 'perfil',
    meta: { campo: 'vistas', valor: 500, unidad: 'visita', unidadPlural: 'visitas' },
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M12 2c1.1 4.2-2 5.2-2 8.2a2 2 0 0 0 4 0c0-1-.1-2-.6-3 2.1 1.6 3.6 4.1 3.6 6.6a7 7 0 1 1-14 0C3 9.2 8.1 7 12 2z\"></path></svg>",
  },
  aclamado: {
    label: "Aclamado",
    rare: 'legendary',
    how: "Diez valoraciones con una media de 4 o más.",
    fuente: 'perfil',
    meta: { campo: 'notas', valor: 10, unidad: 'valoración', unidadPlural: 'valoraciones', minMedia: 4 },
    icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z\"></path></svg>",
  },
};
/**
 * Ids del catálogo anterior que siguen vivos en perfiles ya guardados.
 * Sin esto, quien tuviera "top10" perdería la insignia al cambiar el set.
 */
export const BADGE_ALIAS: Record<string, string> = {
  top10: 'winner',
  supporter: 'donar',
  founder: 'staff',
};

/** Devuelve la insignia de un id, nuevo o heredado. null si ya no existe. */
export function getBadge(id: string): Badge | null {
  const directa = BADGES[id];
  if (directa) return directa;
  const alias = BADGE_ALIAS[id];
  return alias ? BADGES[alias] ?? null : null;
}

/**
 * Pasa una lista de ids al catálogo actual: traduce los heredados, descarta
 * los que ya no existen y quita repetidos (dos ids viejos pueden apuntar a
 * la misma insignia).
 */
export function resolveBadges(ids: string[] | undefined): string[] {
  if (!ids) return [];
  const vistos = new Set<string>();
  for (const id of ids) {
    const real = BADGES[id] ? id : BADGE_ALIAS[id];
    if (real && BADGES[real]) vistos.add(real);
  }
  return [...vistos];
}
