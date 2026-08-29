/*=============== MOBILE MENU ===============*/
const navMenu = document.getElementById("nav-menu");
const navToggle = document.getElementById("nav-toggle");
const navClose = document.getElementById("nav-close");

if (navToggle) {
  navToggle.addEventListener("click", () => navMenu.classList.add("show-menu"));
}

if (navClose) {
  navClose.addEventListener("click", () =>
    navMenu.classList.remove("show-menu"),
  );
}

/*=============== CLOSE MENU ON LINK CLICK ===============*/
const navLinks = document.querySelectorAll(".nav__link");
navLinks.forEach((link) =>
  link.addEventListener("click", () => navMenu.classList.remove("show-menu")),
);

/*=============== HEADER BACKGROUND ON SCROLL ===============*/
function scrollHeader() {
  const header = document.getElementById("header");
  header.classList.toggle("scroll-header", window.scrollY >= 80);
}
window.addEventListener("scroll", scrollHeader);

/*=============== ACTIVE LINK ON SCROLL ===============*/
const sections = document.querySelectorAll("section[id]");

function scrollActive() {
  const scrollY = window.pageYOffset;
  sections.forEach((current) => {
    const sectionHeight = current.offsetHeight;
    const sectionTop = current.offsetTop - 58;
    const sectionId = current.getAttribute("id");

    const link = document.querySelector(`.nav__menu a[href*="${sectionId}"]`);
    if (link) {
      link.classList.toggle(
        "active-link",
        scrollY > sectionTop && scrollY <= sectionTop + sectionHeight,
      );
    }
  });
}
window.addEventListener("scroll", scrollActive);

/*=============== SCROLL TO TOP BUTTON ===============*/
function scrollUp() {
  const scrollUpBtn = document.getElementById("scroll-up");
  scrollUpBtn.classList.toggle("show-scroll", window.scrollY >= 400);
}
window.addEventListener("scroll", scrollUp);

/*=============== THEME TOGGLE ===============*/
const themeButton = document.getElementById("theme-button");
const darkThemeClass = "dark-theme";
const iconThemeClass = "ri-sun-line";

const storedTheme = localStorage.getItem("selected-theme");
const storedIcon = localStorage.getItem("selected-icon");

const getCurrentTheme = () =>
  document.body.classList.contains(darkThemeClass) ? "dark" : "light";
const getCurrentIcon = () =>
  themeButton.classList.contains(iconThemeClass)
    ? "ri-moon-line"
    : "ri-sun-line";

if (storedTheme) {
  document.body.classList[storedTheme === "dark" ? "add" : "remove"](
    darkThemeClass,
  );
  themeButton.classList[storedIcon === "ri-moon-line" ? "add" : "remove"](
    iconThemeClass,
  );
}

themeButton.addEventListener("click", () => {
  document.body.classList.toggle(darkThemeClass);
  themeButton.classList.toggle(iconThemeClass);
  localStorage.setItem("selected-theme", getCurrentTheme());
  localStorage.setItem("selected-icon", getCurrentIcon());
});

/*=============== SCROLL REVEAL ===============*/
const sr = ScrollReveal({
  origin: "top",
  distance: "30px",
  duration: 800,
  delay: 200,
  easing: "ease-out",
  reset: true,
});

sr.reveal(".home__data");
sr.reveal(".home__img", { delay: 500 });
sr.reveal(".home__social", { delay: 600 });
sr.reveal(".about__img, .contact__box", { origin: "left" });
sr.reveal(".about__data, .contact__form", { origin: "right" });
sr.reveal(".project-card", { interval: 100 });
sr.reveal(".footer", { interval: 100 });

/*=============== SKILLS BARS ANIMATION ===============*/
const techBoxElement = document.querySelector(".tech-box");

function resetTechBars() {
  document
    .querySelectorAll(".tech-item__progress")
    .forEach((bar) => (bar.style.width = "0%"));
  document
    .querySelectorAll(".tech-item__percent")
    .forEach((span) => (span.textContent = "0%"));
}

function animateTechBars() {
  document.querySelectorAll(".tech-item").forEach((item) => {
    const bar = item.querySelector(".tech-item__progress");
    const percent = item.querySelector(".tech-item__percent");
    const target = parseInt(percent.dataset.target, 10);

    bar.style.width = target + "%";

    let current = 0;
    const step = target / 60;
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        percent.textContent = target + "%";
        clearInterval(interval);
      } else {
        percent.textContent = Math.round(current) + "%";
      }
    }, 16);
  });
}

if (techBoxElement) {
  sr.reveal(".tech-box", {
    delay: 200,
    beforeReveal: resetTechBars,
    afterReveal: animateTechBars,
  });
}
/*=============== CONTACT FORM (WhatsApp) ===============*/
const contactForm = document.getElementById("contact-form");

contactForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const message = document.getElementById("message").value.trim();

  if (!fullName || !phone || !message) {
    alert("Please fill in all fields");
    return;
  }

  const phoneNumber = "201068480441";
  const timestamp = new Date().toLocaleString();

  const whatsappMessage = `New Client Message\n\nName: ${fullName}\nPhone: ${phone}\nDate: ${timestamp}\n\nMessage:\n${message}`;

  const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
    whatsappMessage,
  )}`;

  window.open(whatsappURL, "_blank");

  document.getElementById("fullName").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("message").value = "";
});
