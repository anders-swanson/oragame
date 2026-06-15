import "./style.css";

type Game = {
  readonly title: string;
  readonly kicker: string;
  readonly description: string;
  readonly href: string;
  readonly image: string;
  readonly status: string;
};

const baseUrl = import.meta.env.BASE_URL;

const games: readonly Game[] = [
  {
    title: "Orasnake",
    kicker: "Live cabinet",
    description: "Snake through database signals, collect Oracle AI Database topics, and turn facts into score.",
    href: "./snake/",
    image: `${baseUrl}orasnake-preview.svg`,
    status: "Play now"
  }
];

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing app root");
}

app.innerHTML = `
  <main class="arcade-shell">
    <section class="intro" aria-labelledby="page-title">
      <p class="eyebrow">Browser arcade for Oracle AI Database</p>
      <h1 id="page-title">Oragame Arcade</h1>
      <p class="lede">
        A small collection of quick, playable games built around database concepts.
      </p>
      <a
        class="repo-link"
        href="https://github.com/anders-swanson/oragame"
        target="_blank"
        rel="noreferrer"
        aria-label="Star the anders-swanson/oragame repository on GitHub"
      >
        Star on GitHub!
      </a>
    </section>

    <section class="cabinet-grid" aria-label="Available games">
      ${games.map(renderGameCard).join("")}
      <article class="coming-soon" aria-label="More games coming soon">
        <div class="coming-soon__screen" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div>
          <p class="card-kicker">Next cabinet</p>
          <h2>More games soon</h2>
          <p>New Oracle AI Database arcade experiments will land here as they ship.</p>
        </div>
      </article>
    </section>
  </main>
`;

function renderGameCard(game: Game): string {
  return `
    <article class="game-card">
      <a class="game-card__link" href="${game.href}" aria-label="Play ${game.title}">
        <img class="game-card__preview" src="${game.image}" alt="${game.title} game preview" />
        <div class="game-card__body">
          <p class="card-kicker">${game.kicker}</p>
          <div class="game-card__title-row">
            <h2>${game.title}</h2>
            <span>${game.status}</span>
          </div>
          <p>${game.description}</p>
        </div>
      </a>
    </article>
  `;
}
