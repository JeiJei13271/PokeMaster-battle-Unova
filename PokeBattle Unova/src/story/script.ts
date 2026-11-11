import type { BattleOutcome, BattleRequest } from '../types';
import type { StoryCtx } from './context';

/**
 * Prólogo de Pueblo Arcilla, con la misma secuencia de eventos que la guía
 * de Pokémon Negro y Blanco. Cada entrada corresponde al campo `dialog` de
 * un NPC o de un prop interactuable en src/world/maps.ts.
 */

const STARTERS = [
  { id: 'snivy', label: 'Snivy (planta)' },
  { id: 'tepig', label: 'Tepig (fuego)' },
  { id: 'oshawott', label: 'Oshawott (agua)' },
];

/** Bel elige el inicial débil contra el tuyo. */
const BEL_PICK: Record<string, string> = {
  snivy: 'oshawott',
  tepig: 'snivy',
  oshawott: 'tepig',
};

/** Cheren elige el inicial fuerte contra el tuyo. */
const CHEREN_PICK: Record<string, string> = {
  snivy: 'tepig',
  tepig: 'oshawott',
  oshawott: 'snivy',
};

const SPECIES_NAMES: Record<string, string> = {
  snivy: 'Snivy',
  tepig: 'Tepig',
  oshawott: 'Oshawott',
};

type Script = (ctx: StoryCtx) => Promise<void>;

function nameOf(id: string | undefined): string {
  return id ? (SPECIES_NAMES[id] ?? 'Pokémon') : 'Pokémon';
}

function trainerBattle(trainerName: string, team: BattleRequest['team']): BattleRequest {
  return { kind: 'trainer', trainerName, team, canCatch: false };
}

/* ------------------------------------------------------------------ */
/* Habitación: el paquete y los primeros combates                      */
/* ------------------------------------------------------------------ */

const paquete: Script = async (ctx) => {
  if (ctx.hasFlag('starter')) {
    await ctx.narrate('La caja está vacía. Encima queda la nota de la Profesora Encina, con la letra apretada.');
    return;
  }

  await ctx.narrate('Sobre el escritorio hay una caja de regalo con una tarjeta.');
  await ctx.say(
    'Nota',
    'Para mis tres jóvenes investigadores: dentro hay un Pokémon para cada uno. Elegid con calma y cuidadlo bien. — Encina',
  );
  await ctx.say('Cheren', 'La Profesora Encina ha pasado por casa y ha dejado esto. Dice que lo abramos los tres juntos.');
  await ctx.say('Bel', '¡Perdón, perdón! Me he entretenido mirando el mar desde la cuesta... ¿Ya lo habéis abierto?');
  await ctx.say('Cheren', 'Te esperábamos a ti, Bel. Adelante, abre la caja.');
  await ctx.narrate('Levantas la tapa. Tres Poké Balls descansan sobre terciopelo, cada una con una etiqueta.');

  const pick = await ctx.choice(STARTERS.map((s) => s.label));
  const chosen = STARTERS[pick] ?? STARTERS[0];
  ctx.give(chosen.id, 5);
  ctx.setFlag('starter');
  ctx.toast(`¡Has recibido a ${nameOf(chosen.id)}!`);

  await ctx.say('Bel', `¡Qué mono! Entonces yo me quedo con este. ¡Mirad qué cara de pocos amigos!`);
  await ctx.say(
    'Cheren',
    'Yo tomaré el que tiene ventaja sobre el tuyo. Nada personal: quiero un combate que merezca la pena.',
  );
  await ctx.say('Bel', '¡Venga, un combate rápido! Son pequeños todavía, pero hay que empezar por algo, ¿no?');
  ctx.objective('Habla con Bel para tu primer combate');
};

const belHabitacion: Script = async (ctx) => {
  const starter = ctx.starterId();
  if (!starter) {
    await ctx.say('Bel', '¡Abre la caja primero! Tengo muchísimas ganas de ver qué nos ha dejado la Profesora Encina.');
    return;
  }

  if (ctx.hasFlag('bel_derrotada')) {
    await ctx.say('Bel', 'Se me da mejor estudiar que luchar... Cheren te espera. Quiere medirte él también.');
    return;
  }

  const pick = BEL_PICK[starter] ?? 'oshawott';
  await ctx.say('Bel', `¡Allá voy! He elegido a ${nameOf(pick)}. No pienso ponértelo fácil.`);
  const outcome = await ctx.battle(
    trainerBattle('Bel', [{ speciesId: pick, level: 5 }]),
  );

  ctx.setFlag('bel_derrotada');
  if (outcome === 'win') {
    await ctx.say('Bel', '¡Se ha quedado la habitación patas arriba! Y mi Pokémon está agotado...');
    await ctx.say('Bel', 'Vale, ganas tú esta. Pero Cheren quiere luchar contigo antes de bajar.');
  } else {
    ctx.heal();
    await ctx.say('Bel', '¡Uy! Creo que me he emocionado. Te he curado el equipo: Cheren no perdona los descuidos.');
  }
  ctx.objective('Habla con Cheren');
};

const cherenHabitacion: Script = async (ctx) => {
  if (!ctx.hasFlag('bel_derrotada')) {
    await ctx.say('Cheren', 'Bel quiere luchar primero. Yo espero mi turno; la paciencia también se entrena.');
    return;
  }

  if (ctx.hasFlag('cheren_derrotado')) {
    await ctx.say('Cheren', 'Bajemos. Tu madre nos ha llamado dos veces y no me gusta hacerla esperar.');
    return;
  }

  const pick = CHEREN_PICK[ctx.starterId() ?? 'snivy'] ?? 'tepig';
  await ctx.say('Cheren', 'Antes de bajar, comprobemos lo que has aprendido. Te he curado el equipo: así no hay excusas.');
  ctx.heal();
  await ctx.say('Cheren', `He elegido a ${nameOf(pick)}. Muévete; quedarse quieto es la forma más rápida de perder.`);
  const outcome = await ctx.battle(
    trainerBattle('Cheren', [{ speciesId: pick, level: 5 }]),
  );

  ctx.setFlag('cheren_derrotado');
  if (outcome === 'win') {
    await ctx.say('Cheren', 'Tienes instinto. Eso no viene en los libros, y es lo que más me interesa de ti.');
  } else {
    ctx.heal();
    await ctx.say('Cheren', 'La próxima vez recuerda moverte entre ataque y ataque. Te he curado el equipo.');
  }
  await ctx.say('Cheren', 'Bajemos. Tu madre nos espera, y luego tenemos que hablar de algo importante.');
  ctx.objective('Baja a hablar con tu madre');
};

/* ------------------------------------------------------------------ */
/* Planta baja: la madre y el Videomisor                               */
/* ------------------------------------------------------------------ */

const madre: Script = async (ctx) => {
  if (!ctx.hasFlag('cheren_derrotado')) {
    await ctx.say('Madre', 'Sube, tus amigos te están esperando. ¡Y no corráis dentro de casa, que se oye todo!');
    return;
  }

  if (ctx.hasFlag('videomisor')) {
    await ctx.say('Madre', '¿Ya te vas? Llámame de vez en cuando con el Videomisor. Y come algo caliente, por favor.');
    ctx.heal();
    await ctx.say('Madre', 'Anda, tu equipo está como nuevo. Ahora ve a ver a la Profesora Encina.');
    return;
  }

  await ctx.say('Cheren', 'Ya bajamos, señora. Gracias por dejarnos usar la habitación... aunque ha quedado un poco revuelta.');
  await ctx.say('Bel', '¡Ha sido un combate épico! Bueno, casi. ¡Nos vemos en el laboratorio!');
  await ctx.narrate('Cheren y Bel salen de casa. Tu madre suspira, sonríe y se acerca.');
  ctx.heal();
  await ctx.say(
    'Madre',
    'Menudo jaleo habéis montado ahí arriba. Toma: tu Videomisor. Sirve para llamar y para ver la cara de quien te importa.',
  );
  await ctx.say('Madre', 'Cheren te espera en la puerta del laboratorio. Dice que todavía falta Bel para poder entrar.');
  ctx.setFlag('videomisor');
  ctx.toast('Has recibido el Videomisor.');
  ctx.objective('Habla con Cheren en la puerta del laboratorio');
};

/* ------------------------------------------------------------------ */
/* Pueblo: Cheren, Bel y el mapa                                       */
/* ------------------------------------------------------------------ */

const cherenPueblo: Script = async (ctx) => {
  if (ctx.hasFlag('bel_avisada')) {
    await ctx.say('Cheren', 'Ya está aquí Bel. Entremos; la Profesora Encina nos estaba esperando.');
    ctx.objective('Entra en el laboratorio');
    return;
  }

  await ctx.say('Cheren', 'La Profesora Encina nos espera dentro, pero no quiere empezar sin los tres.');
  await ctx.say(
    'Cheren',
    'Bel ha ido a su casa, al suroeste, a avisar a sus padres. Ve a buscarla; yo vigilo la puerta.',
  );
  if (!ctx.hasFlag('encargo_bel')) {
    ctx.setFlag('encargo_bel');
    ctx.toast('Cheren te ha pedido que busques a Bel.');
  }
  ctx.objective('Busca a Bel en su casa, al suroeste');
};

const belCasa: Script = async (ctx) => {
  if (ctx.hasFlag('bel_avisada')) {
    await ctx.say('Bel', '¡Ya voy, ya voy! El laboratorio está al este del pueblo. ¡No me dejes atrás!');
    return;
  }
  await ctx.say('Bel', '¡Ah, eres tú! Mi padre dice que soy un desastre y que no me deja ir sola a ningún sitio.');
  await ctx.say('Bel', 'Le he dicho que voy con Cheren y contigo. ¡Ya está, vamos al laboratorio antes de que cambie de idea!');
  ctx.setFlag('bel_avisada');
  ctx.toast('Bel se ha ido corriendo al laboratorio.');
  ctx.objective('Entra en el laboratorio con Cheren');
};

const belPadre: Script = async (ctx) => {
  await ctx.say('Padre de Bel', 'Bel es buena chica, pero se le olvida todo. Si vais juntos de viaje, cuidadla un poco.');
  if (ctx.hasFlag('starter')) {
    await ctx.say('Padre de Bel', 'Y tú... no te metas en líos, ¿eh? Que luego llaman a casa y nos enteramos nosotros.');
  }
};

const belMadre: Script = async (ctx) => {
  await ctx.say('Madre de Bel', 'Bel ha salido disparada hacia el laboratorio. ¡Lleva el gorro torcido y ni se ha mirado al espejo!');
};

const madreMapa: Script = async (ctx) => {
  if (ctx.hasFlag('mapa')) {
    await ctx.say('Madre', 'El mapa no muerde, ¿eh? Míralo cuando te pierdas y llámame si necesitas algo.');
    return;
  }
  await ctx.say('Madre', '¡Espera, se me olvidaba lo más importante!');
  await ctx.say('Madre', 'Toma el mapa de Teselia. No te pierdas por el norte, que luego me llamas llorando desde un camino.');
  ctx.setFlag('mapa');
  ctx.toast('Has recibido el Mapa de Teselia.');
  await ctx.say('Madre', 'Bel te espera en la salida del pueblo. Dice que el primer paso hay que darlo juntos.');
  ctx.objective('Habla con Bel en la salida norte');
};

const belPaso: Script = async (ctx) => {
  if (ctx.hasFlag('paso_juntos')) {
    await ctx.say('Bel', '¡Vamos! La Profesora Encina nos espera en la Ruta 1. Y esta vez no me quedo atrás.');
    return;
  }
  await ctx.say('Bel', '¡Espera! El primer paso del viaje hay que darlo juntos, ¿no? Es lo que hace la gente normal.');
  await ctx.say('Bel', 'A la de tres: uno... dos... ¡tres!');
  await ctx.narrate('Dais el paso al mismo tiempo. Al fondo del camino, la Profesora Encina os saluda con la mano.');
  ctx.setFlag('paso_juntos');
  ctx.toast('¡Habéis empezado el viaje juntos!');
  ctx.objective('Habla con la Profesora Encina en la Ruta 1');
};

/* ------------------------------------------------------------------ */
/* Laboratorio: la Pokédex                                             */
/* ------------------------------------------------------------------ */

const encina: Script = async (ctx) => {
  if (ctx.hasFlag('pokedex')) {
    await ctx.say('Encina', 'La Pokédex guarda todo lo que veáis. Cuantos más Pokémon registréis, más sabremos de Teselia.');
    ctx.heal();
    await ctx.say('Encina', 'Os he curado el equipo. Ahora salid y hacedme sentir orgullosa.');
    return;
  }

  await ctx.say('Encina', 'Habéis llegado justo a tiempo. Os he estado observando desde la ventana: los tres tenéis algo especial.');
  await ctx.say(
    'Encina',
    'Quiero pediros un favor enorme. Llevad una Pokédex y registrad a todos los Pokémon de Teselia. Nadie lo ha hecho nunca.',
  );

  const pick = await ctx.choice(['Acepto encantado', '¿Puedo pensarlo?']);
  if (pick !== 0) {
    await ctx.say('Encina', 'Claro que sí. Pero el mundo no espera: vuelve cuando lo tengas claro y hablamos.');
    return;
  }

  await ctx.say('Encina', '¡Sabía que dirías que sí! Toma tu Pokédex. Se abre sola cuando veis un Pokémon nuevo.');
  await ctx.say('Encina', 'Bel, Cheren: vosotros también llevaréis una. Y ahora, salid a probarla. ¡Hay una ruta entera ahí fuera!');
  ctx.setFlag('pokedex');
  ctx.toast('Has recibido la Pokédex.');
  ctx.objective('Habla con tu madre en la calle');
};

const cherenLab: Script = async (ctx) => {
  if (!ctx.hasFlag('pokedex')) {
    await ctx.say('Cheren', 'Escucha a la profesora. Yo también estoy nervioso, pero no lo voy a decir en voz alta.');
    return;
  }
  await ctx.say('Cheren', 'Una Pokédex... Ahora sí que empieza el viaje. Nos veremos en Pueblo Terracota, ¿vale?');
};

const belLab: Script = async (ctx) => {
  if (!ctx.hasFlag('pokedex')) {
    await ctx.say('Bel', '¡Qué laboratorio tan grande! Mi padre dice que aquí se estudian los sueños de los Pokémon.');
    return;
  }
  await ctx.say('Bel', '¡Voy a registrar a todos los Pokémon que vea! Aunque se me olvide apuntarlos, claro...');
};

/* ------------------------------------------------------------------ */
/* Ruta 1: tutorial de captura                                         */
/* ------------------------------------------------------------------ */

const encinaRuta: Script = async (ctx) => {
  if (ctx.hasFlag('tutorial_captura')) {
    ctx.heal();
    await ctx.say('Encina', 'Ya sabes lo importante: debilita y lanza la Poké Ball con C. Te he curado el equipo, sigue al norte.');
    return;
  }
  await ctx.say('Encina', 'Antes de que sigáis: aprender a capturar es lo más importante de todo el viaje.');
  await ctx.say(
    'Encina',
    'Debilita al Pokémon salvaje y lanza una Poké Ball con C. Cuanto más débil esté, más fácil será la captura.',
  );
  await ctx.say('Encina', 'Mirad, hay un Patrat entre la hierba. Vamos a practicar con él.');

  const outcome: BattleOutcome = await ctx.battle({
    kind: 'wild',
    canCatch: true,
    team: [{ speciesId: 'patrat', level: 2 }],
  });

  if (outcome === 'caught') {
    await ctx.say('Encina', '¡Perfecto! Se te da mejor que a mí en mis primeros años de investigación.');
  } else {
    await ctx.say('Encina', 'No pasa nada. A veces se escapa; prueba otra vez con cualquier salvaje de la hierba.');
  }
  await ctx.say('Encina', 'Toma estas cinco Poké Ball de mi parte. Y recuerda: una captura no es una derrota.');
  ctx.setFlag('tutorial_captura');
  ctx.toast('Has recibido 5 Poké Balls.');
  ctx.objective('Llega a Pueblo Terracota al norte');
  await ctx.say('Encina', 'Bel y Cheren se han adelantado. ¡Nos vemos en Pueblo Terracota!');
};

/* ------------------------------------------------------------------ */
/* Pueblo: vecinos                                                     */
/* ------------------------------------------------------------------ */

const vecina: Script = async (ctx) => {
  if (!ctx.hasFlag('starter')) {
    await ctx.say('Vecina', 'La Profesora Encina ha dejado un paquete en tu casa. ¡Qué emoción, un Pokémon para cada uno!');
    return;
  }
  await ctx.say('Vecina', '¿Vas a la Ruta 1? En la hierba alta no se ve el suelo. Camina despacio o te saldrán tres a la vez.');
  await ctx.say('Vecina', 'Y no te olvides de esquivar. Con ESPACIO te mueves rápido un instante y los ataques te atraviesan.');
};

const nino: Script = async (ctx) => {
  if (!ctx.hasFlag('starter')) {
    await ctx.say('Niño', 'Mi hermana dice que la profesora regala criaturas. ¡Yo quiero una que eche chispas!');
    return;
  }
  await ctx.say('Niño', 'Cuando una criatura salvaje está muy débil, lanzas la Poké Ball con la tecla C.');
  await ctx.say('Niño', 'Si falla, se enfada y ataca más rápido. ¡A mí me pasó y salí corriendo!');
};

/* ------------------------------------------------------------------ */
/* Ruta 1 y Bosque: entrenadores y jefe (contenido de la demo)         */
/* ------------------------------------------------------------------ */

const trainerLeo: Script = async (ctx) => {
  if (ctx.hasFlag('leo_derrotado')) {
    await ctx.say('Joven Leo', 'Tu forma de moverte me ha dado ideas. Cuando entrene un poco más, te busco.');
    return;
  }
  await ctx.say('Joven Leo', '¡Alto! Aquí se entrena. Si quieres pasar, tendrás que ganarte el camino.');
  await ctx.say('Joven Leo', 'Dos contra los que traigas. Yo empiezo con Patrat, así que cuidado con sus mordiscos.');

  const outcome = await ctx.battle(
    trainerBattle('Joven Leo', [
      { speciesId: 'patrat', level: 5 },
      { speciesId: 'lillipup', level: 5 },
    ]),
  );

  if (outcome === 'win') {
    ctx.setFlag('leo_derrotado');
    await ctx.say('Joven Leo', '¡Buen combate! Toma, te doy una pista: en el bosque hay un claro al noroeste.');
    ctx.objective('Cruza la Ruta 1 y entra en el Bosque de Teselia');
    ctx.toast('¡Has ganado 120 de experiencia!');
  } else {
    ctx.heal();
    await ctx.say('Joven Leo', 'Te has quedado sin energía demasiado pronto. Cúrate y vuelve a intentarlo.');
  }
};

const trainerEva: Script = async (ctx) => {
  if (ctx.hasFlag('eva_derrotada')) {
    await ctx.say('Senderista Eva', 'El bosque está tranquilo hoy... demasiado. Mantén los ojos abiertos.');
    return;
  }
  await ctx.say('Senderista Eva', 'Vengo del bosque y no me gusta lo que he visto. Si vas hacia allí, demuéstrame que sabes luchar.');
  await ctx.say('Senderista Eva', 'Pidove es rápido, pero Roggenrola aguanta. Elige bien cuándo atacar y cuándo correr.');

  const outcome = await ctx.battle(
    trainerBattle('Senderista Eva', [
      { speciesId: 'pidove', level: 6 },
      { speciesId: 'roggenrola', level: 6 },
    ]),
  );

  if (outcome === 'win') {
    ctx.setFlag('eva_derrotada');
    await ctx.say('Senderista Eva', 'Con esa puntería puedes entrar. El Comandante Vega está en el claro del norte.');
    ctx.objective('Encuentra al Comandante Vega en el Bosque de Teselia');
    ctx.toast('¡Has ganado 150 de experiencia!');
  } else {
    ctx.heal();
    await ctx.say('Senderista Eva', 'Descansa. El bosque no se va a mover de sitio esta noche.');
  }
};

const senderista: Script = async (ctx) => {
  await ctx.say('Senderista', 'El Equipo Sombra lleva semanas talando árboles del bosque. Dicen que buscan algo bajo las raíces.');
  await ctx.say('Senderista', 'Si vas a enfrentarte a ellos, lleva el equipo descansado. No hay centro de curación más allá de la ruta.');
};

const bossVega: Script = async (ctx) => {
  if (ctx.hasFlag('vega_derrotado')) {
    await ctx.say(
      'Comandante Vega',
      'Te has ganado mi respeto. Me retiro... por ahora. Teselia es más grande de lo que crees.',
    );
    return;
  }

  await ctx.say('Comandante Vega', 'Así que la profesora ha mandado a un niño con una criatura recién salida del cascarón.');
  await ctx.say(
    'Comandante Vega',
    'Bajo este bosque duerme algo que cambiará la forma de luchar en toda la región. No pienso compartirlo.',
  );
  await ctx.say('Comandante Vega', 'Si quieres impedirlo, demuéstrame que puedes conmigo. Purrloin abre el combate.');

  const outcome = await ctx.battle(
    trainerBattle('Comandante Vega', [
      { speciesId: 'purrloin', level: 9 },
      { speciesId: 'boldore', level: 10 },
    ]),
  );

  if (outcome === 'win') {
    ctx.setFlag('vega_derrotado');
    await ctx.say('Comandante Vega', 'Imposible... he perdido contra alguien que lucha moviéndose, no esperando turnos.');
    await ctx.say('Comandante Vega', 'Esto no ha terminado. Pero hoy el bosque es tuyo.');
    ctx.objective('');
    ctx.toast('¡Has completado la demo de PokeMaster Battle Unova!');
    ctx.endDemo();
  } else {
    ctx.heal();
    await ctx.say('Comandante Vega', 'Vuelve cuando tengas algo más que reflejos. Aquí estaré.');
  }
};

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Pueblo Terracota (Fase 5)                                           */
/* ------------------------------------------------------------------ */

const enfermera: Script = async (ctx) => {
  await ctx.say('Enfermera Joy', '¡Bienvenido al Centro Pokémon! ¿Quieres que cure a tu equipo?');
  ctx.heal();
  ctx.setFlag('centro_visitado');
  await ctx.say('Enfermera Joy', '¡Listo! Tus criaturas están como nuevas. Vuelve siempre que lo necesites.');
  if (!ctx.hasFlag('berto_derrotado')) {
    ctx.objective('Habla con el Colegial Berto, junto a la fuente');
  }
};

const trainerTerracota: Script = async (ctx) => {
  if (ctx.hasFlag('berto_derrotado')) {
    await ctx.say('Colegial Berto', 'Ese combate me ha enseñado más que un mes de clase. La próxima vez no me pillas.');
    return;
  }
  await ctx.say('Colegial Berto', '¡Eh, tú! Acabas de llegar, ¿verdad? Aquí todo el mundo entrena antes de ir al bosque.');
  await ctx.say('Colegial Berto', 'Tengo dos criaturas y muchas ganas de probarlas. ¿Vamos?');

  const outcome = await ctx.battle(
    trainerBattle('Colegial Berto', [
      { speciesId: 'patrat', level: 6 },
      { speciesId: 'purrloin', level: 7 },
    ]),
  );

  if (outcome === 'win') {
    ctx.setFlag('berto_derrotado');
    await ctx.say('Colegial Berto', '¡Vaya! Se nota que vienes de entrenar en la Ruta 1.');
    await ctx.say('Colegial Berto', 'El Bosque de Teselia está al este del pueblo. Dicen que hay gente sospechosa por allí.');
    ctx.objective('Cruza el Bosque de Teselia por el este');
    ctx.toast('¡Has ganado 200 de experiencia!');
  } else {
    ctx.heal();
    await ctx.say('Colegial Berto', 'Te has quedado sin energía. Cúrate en el Centro Pokémon y vuelve cuando quieras.');
    ctx.objective('Cura a tu equipo en el Centro Pokémon');
  }
};

const terracotaVecino: Script = async (ctx) => {
  await ctx.say('Vecino', 'Pueblo Terracota es la encrucijada de Teselia: al sur, Pueblo Arcilla; al este, el bosque.');
  if (!ctx.hasFlag('centro_visitado')) {
    await ctx.say('Vecino', 'Si tu equipo está cansado, entra en el Centro Pokémon del tejado rojo. La Enfermera Joy no cobra nada.');
  } else {
    await ctx.say('Vecino', 'Se nota que ya has pasado por el Centro: tus criaturas tienen otra cara.');
  }
};

const terracotaNina: Script = async (ctx) => {
  await ctx.say('Niña', 'Mi hermano dice que en el bosque hay un claro donde no cantan los Pidove. ¡Qué miedo!');
  await ctx.say('Niña', 'Si vas, lleva Pociones. Yo no tengo, pero mi madre sí... y no me deja cogerlas.');
};

export const SCRIPTS: Record<string, Script> = {
  enfermera,
  trainer_terracota: trainerTerracota,
  terracota_vecino: terracotaVecino,
  terracota_nina: terracotaNina,
  paquete,
  bel_habitacion: belHabitacion,
  cheren_habitacion: cherenHabitacion,
  madre,
  cheren_pueblo: cherenPueblo,
  bel_casa: belCasa,
  bel_padre: belPadre,
  bel_madre: belMadre,
  madre_mapa: madreMapa,
  bel_paso: belPaso,
  encina,
  cheren_lab: cherenLab,
  bel_lab: belLab,
  encina_ruta: encinaRuta,
  vecina,
  nino,
  trainer_leo: trainerLeo,
  trainer_eva: trainerEva,
  senderista,
  boss_vega: bossVega,
};

export const FALLBACK: Script = async (ctx) => {
  await ctx.narrate('No pasa nada interesante por aquí.');
};

export async function runScript(id: string, ctx: StoryCtx): Promise<void> {
  const script = SCRIPTS[id] ?? FALLBACK;
  await script(ctx);
}
