let funnel = null;
let steps = [];
let currentStepIndex = 0;
let answers = {};
let carouselTimers = [];

async function startQuiz() {
  const response = await fetch("quiz-data.json");
  const data = await response.json();

  funnel = data.funnel;
  steps = funnel.steps || [];

  showStepByIndex(0);
}

function clearCarouselTimers() {
  carouselTimers.forEach(timer => clearInterval(timer));
  carouselTimers = [];
}

function getProgressPercent(step) {
  if (!step || !steps.length) return 0;
  return ((step.position || 0) / Math.max(steps.length - 1, 1)) * 100;
}

function replaceVars(text = "") {
  return text.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const cleanKey = key.trim();
    return answers[cleanKey] || "";
  });
}

function findStepIndexById(stepId) {
  return steps.findIndex(step => step.id === stepId);
}

function goNextDefault() {
  if (currentStepIndex < steps.length - 1) {
    showStepByIndex(currentStepIndex + 1);
  }
}

function goToDestination(destination) {
  const idx = findStepIndexById(destination);
  if (idx >= 0) {
    showStepByIndex(idx);
  } else {
    goNextDefault();
  }
}

function renderLogo(step) {
  if (!step.showLogo) return "";

  const logo = funnel?.designSettings?.header?.logoContent || "";
  if (!logo) return "";

  return `
    <div class="quiz-logo">
      <img src="${logo}" alt="Logo">
    </div>
  `;
}

function renderProgress(step) {
  if (!step.showProgress) return "";
  const percent = getProgressPercent(step);
  return `
    <div class="progress-wrap">
      <div class="progress-bar">
        <div class="progress-fill" style="width:${percent}%"></div>
      </div>
    </div>
  `;
}

function sortedComponents(step) {
  return [...(step.components || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
}

function createTextBlock(html) {
  const div = document.createElement("div");
  div.className = "text-block";
  div.innerHTML = replaceVars(html || "");
  return div;
}

function createImage(src) {
  const img = document.createElement("img");
  img.className = "main-image";
  img.src = src;
  img.alt = "";
  return img;
}

function stripHtml(html = "") {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

function getOptionLabel(option) {
  return replaceVars(option.name || "Opção");
}

function ensureStepState(step) {
  const key = step.id;
  if (!answers.__stepState) answers.__stepState = {};
  if (!answers.__stepState[key]) {
    answers.__stepState[key] = {};
  }
  return answers.__stepState[key];
}

function createOptions(component, container, step) {
  const meta = component.metadata || {};
  const list = document.createElement("div");
  list.className = "option-list";

  const autoProceed = !!meta.autoProceed;
  const detailArrow = meta.detail === "arrow";
  const disposition = meta.disposition || "noImage";
  const multiple = !!meta.multiple;
  const options = meta.options || [];
  const fieldKey = component.name || component.id;
  const stepState = ensureStepState(step);

  if (!stepState[fieldKey]) {
    stepState[fieldKey] = multiple ? [] : null;
  }

  options.forEach(option => {
    const item = document.createElement("div");
    item.className = "option-item";

    const iconValue = option.icon || "";
    const iconType = option.iconType || "";
    const hasVisual = disposition === "imageFirst" || !!iconValue;

    if (hasVisual) {
      const icon = document.createElement("div");
      icon.className = "option-icon";

      if (iconType === "url" && iconValue) {
        const img = document.createElement("img");
        img.src = iconValue;
        img.alt = "";
        icon.appendChild(img);
      } else {
        icon.textContent = iconValue || "";
      }

      item.appendChild(icon);
    }

    const text = document.createElement("div");
    text.className = "option-text";
    text.innerHTML = getOptionLabel(option);
    item.appendChild(text);

    if (detailArrow) {
      const arrow = document.createElement("div");
      arrow.className = "option-arrow";
      arrow.innerHTML = "→";
      item.appendChild(arrow);
    }

    const refreshSelectedVisual = () => {
      if (multiple) {
        const selectedIds = stepState[fieldKey] || [];
        if (selectedIds.includes(option.id)) {
          item.classList.add("selected");
        } else {
          item.classList.remove("selected");
        }
      } else {
        if (stepState[fieldKey] === option.id) {
          item.classList.add("selected");
        } else {
          item.classList.remove("selected");
        }
      }
    };

    refreshSelectedVisual();

    item.onclick = () => {
      if (multiple) {
        let selectedIds = stepState[fieldKey] || [];
        if (selectedIds.includes(option.id)) {
          selectedIds = selectedIds.filter(id => id !== option.id);
        } else {
          selectedIds = [...selectedIds, option.id];
        }

        stepState[fieldKey] = selectedIds;

        answers[fieldKey] = selectedIds.map(id => {
          const found = options.find(o => o.id === id);
          return stripHtml(found?.name || "");
        });

        refreshAllOptions(list, options, fieldKey, stepState, multiple);
        return;
      }

      stepState[fieldKey] = option.id;
      answers[fieldKey] = stripHtml(option.name || "");

      refreshAllOptions(list, options, fieldKey, stepState, multiple);

      if (autoProceed && option.destination) {
        goToDestination(option.destination);
        return;
      }

      if (autoProceed) {
        goNextDefault();
      }
    };

    list.appendChild(item);
  });

  container.appendChild(list);
}

function refreshAllOptions(list, options, fieldKey, stepState, multiple) {
  const items = list.querySelectorAll(".option-item");
  items.forEach((item, index) => {
    const option = options[index];
    if (!option) return;

    if (multiple) {
      const selectedIds = stepState[fieldKey] || [];
      item.classList.toggle("selected", selectedIds.includes(option.id));
    } else {
      item.classList.toggle("selected", stepState[fieldKey] === option.id);
    }
  });
}

function createInput(component, container, step) {
  const wrap = document.createElement("div");
  wrap.className = "input-wrap";

  const input = document.createElement("input");
  input.className = "input-field";
  input.type = "text";
  input.placeholder = component.metadata?.placeholder || "";

  const key = component.name || component.id;
  const stepState = ensureStepState(step);

  input.value = answers[key] || "";

  input.oninput = (e) => {
    const value = e.target.value;
    answers[key] = value;
    stepState[key] = value;
  };

  wrap.appendChild(input);
  container.appendChild(wrap);
}

function validateCurrentStep(step) {
  const components = sortedComponents(step);
  const stepState = ensureStepState(step);

  for (const component of components) {
    if (component.type === "input") {
      const key = component.name || component.id;
      const required = !!component.metadata?.required;
      const value = (answers[key] || "").trim();

      if (required && !value) {
        return "Preencha o campo antes de continuar.";
      }
    }

    if (component.type === "options") {
      const required = !!component.metadata?.required;
      const autoProceed = !!component.metadata?.autoProceed;
      const multiple = !!component.metadata?.multiple;
      const key = component.name || component.id;

      if (!required || autoProceed) continue;

      if (multiple) {
        const selected = stepState[key] || [];
        if (!selected.length) {
          return "Escolha pelo menos uma opção antes de continuar.";
        }
      } else {
        const selected = stepState[key];
        if (!selected) {
          return "Escolha uma opção antes de continuar.";
        }
      }
    }
  }

  return "";
}

function createValidationMessage(container) {
  const msg = document.createElement("div");
  msg.className = "validation-message hidden";
  msg.id = "validation-message";
  container.appendChild(msg);
}

function showValidationMessage(text) {
  const msg = document.getElementById("validation-message");
  if (!msg) return;
  if (!text) {
    msg.textContent = "";
    msg.classList.add("hidden");
    return;
  }
  msg.textContent = text;
  msg.classList.remove("hidden");
}

function createButton(component, container, step) {
  const btn = document.createElement("button");
  btn.className = "btn-main";
  btn.textContent = replaceVars(component.metadata?.content || "Continuar");

  btn.onclick = () => {
    showValidationMessage("");

    const actionType = component.metadata?.actionType || "nextStep";
    const url = component.metadata?.url || "";

    if (actionType !== "redirect") {
      const validationError = validateCurrentStep(step);
      if (validationError) {
        showValidationMessage(validationError);
        return;
      }
    }

    if (actionType === "redirect" && url) {
  const finalUrl = url + window.location.search;
  window.location.href = finalUrl;
  return;
}

    if (actionType === "nextStep" && url && url !== "next") {
      goToDestination(url);
      return;
    }

    goNextDefault();
  };

  container.appendChild(btn);
}

function createAlert(component, container) {
  const box = document.createElement("div");
  box.className = "alert-box";
  box.textContent = replaceVars(component.metadata?.description || "");
  container.appendChild(box);
}

function createLevel(component, container) {
  const meta = component.metadata || {};
  const target = parseFloat(replaceVars(String(meta.target || 0)));
  const safeTarget = Math.max(0, Math.min(100, isNaN(target) ? 0 : target));

  const box = document.createElement("div");
  box.className = "level-box";

  const header = document.createElement("div");
  header.className = "level-header";
  header.textContent = replaceVars(meta.subtitle || meta.title || "");
  box.appendChild(header);

  const track = document.createElement("div");
  track.className = "level-track";

  const fill = document.createElement("div");
  fill.className = "level-fill";
  fill.style.width = safeTarget + "%";

  track.appendChild(fill);
  box.appendChild(track);

  if (meta.legends && meta.legends.length) {
    const legends = document.createElement("div");
    legends.className = "level-legends";
    meta.legends.forEach(item => {
      const span = document.createElement("span");
      span.textContent = item;
      legends.appendChild(span);
    });
    box.appendChild(legends);
  }

  container.appendChild(box);
}

function createCompare(component, container) {
  const meta = component.metadata || {};
  const box = document.createElement("div");
  box.className = "compare-box";

  const images = document.createElement("div");
  images.className = "compare-images";

  const img1 = document.createElement("img");
  img1.src = meta.firstImage || "";

  const img2 = document.createElement("img");
  img2.src = meta.secondImage || "";

  images.appendChild(img1);
  images.appendChild(img2);
  box.appendChild(images);

  container.appendChild(box);
}

function createCarousel(component, container) {
  const items = component.metadata?.items || [];
  if (!items.length) return;

  const box = document.createElement("div");
  box.className = "carousel-box";

  const main = document.createElement("div");
  main.className = "carousel-main";

  const img = document.createElement("img");
  img.src = items[0].content || "";
  main.appendChild(img);
  box.appendChild(main);
  container.appendChild(box);

  if (items.length > 1) {
    let idx = 0;
    const delay = component.metadata?.delay || 2000;
    const timer = setInterval(() => {
      idx = (idx + 1) % items.length;
      img.src = items[idx].content || "";
    }, delay);
    carouselTimers.push(timer);
  }
}

function createLoader(component, container) {
  const meta = component.metadata || {};
  const duration = Number(meta.duration || 5);
  const target = Number(meta.target || 100);
  const label = meta.label || "Carregando...";

  const box = document.createElement("div");
  box.className = "loader-box";

  const top = document.createElement("div");
  top.className = "loader-top";
  top.innerHTML = `<span>${label}</span><span id="loader-percent">0%</span>`;

  const track = document.createElement("div");
  track.className = "loader-track";

  const fill = document.createElement("div");
  fill.className = "loader-fill";

  track.appendChild(fill);
  box.appendChild(top);
  box.appendChild(track);
  container.appendChild(box);

  let progress = 0;
  const totalMs = duration * 1000;
  const intervalMs = 100;
  const step = Math.max(1, target / (totalMs / intervalMs));

  const interval = setInterval(() => {
    progress += step;
    if (progress >= target) progress = target;

    fill.style.width = progress + "%";
    const labelPercent = document.getElementById("loader-percent");
    if (labelPercent) labelPercent.textContent = Math.round(progress) + "%";

    if (progress >= target) {
      clearInterval(interval);
      setTimeout(() => {
        goNextDefault();
      }, 500);
    }
  }, intervalMs);

  carouselTimers.push(interval);
}

function createPricing(component, container) {
  const meta = component.metadata || {};

  const box = document.createElement("div");
  box.className = "pricing-box";

  if (meta.highlight) {
    const highlight = document.createElement("div");
    highlight.className = "pricing-highlight";
    highlight.textContent = meta.highlight;
    box.appendChild(highlight);
  }

  const title = document.createElement("div");
  title.className = "pricing-title";
  title.textContent = replaceVars(meta.title || "");
  box.appendChild(title);

  const prefix = document.createElement("div");
  prefix.className = "pricing-prefix";
  prefix.textContent = replaceVars(meta.prefix || "");
  box.appendChild(prefix);

  const value = document.createElement("div");
  value.className = "pricing-value";
  value.textContent = replaceVars(meta.value || "");
  box.appendChild(value);

  const suffix = document.createElement("div");
  suffix.className = "pricing-suffix";
  suffix.textContent = replaceVars(meta.suffix || "");
  box.appendChild(suffix);

  container.appendChild(box);
}

function createReviews(component, container) {
  const items = component.metadata?.items || [];
  const list = document.createElement("div");
  list.className = "review-list";

  items.forEach(item => {
    const review = document.createElement("div");
    review.className = "review-item";

    const name = document.createElement("div");
    name.className = "review-name";
    name.textContent = item.name || "";

    const rating = document.createElement("div");
    rating.className = "review-rating";
    rating.textContent = "★".repeat(item.rating || 5);

    const desc = document.createElement("div");
    desc.textContent = item.description || "";

    review.appendChild(name);
    review.appendChild(rating);
    review.appendChild(desc);
    list.appendChild(review);
  });

  container.appendChild(list);
}

function showStepByIndex(index) {
  clearCarouselTimers();

  currentStepIndex = index;
  const step = steps[index];
  if (!step) return;

  const quiz = document.getElementById("quiz");
  quiz.innerHTML = `
    <div class="quiz-card">
      ${renderLogo(step)}
      ${renderProgress(step)}
      <div class="step-box">
        <div id="step-content"></div>
      </div>
    </div>
  `;

  const content = document.getElementById("step-content");
  const components = sortedComponents(step);

  components.forEach(component => {
    const type = component.type;

    if (type === "paragraph" || type === "heading") {
      content.appendChild(createTextBlock(component.metadata?.content || ""));
      return;
    }

    if (type === "image") {
      const src = component.metadata?.content || "";
      if (src) content.appendChild(createImage(src));
      return;
    }

    if (type === "options") {
      createOptions(component, content, step);
      return;
    }

    if (type === "input") {
      createInput(component, content, step);
      return;
    }

    if (type === "button") {
      createButton(component, content, step);
      return;
    }

    if (type === "alert") {
      createAlert(component, content);
      return;
    }

    if (type === "level") {
      createLevel(component, content);
      return;
    }

    if (type === "compare") {
      createCompare(component, content);
      return;
    }

    if (type === "carousel") {
      createCarousel(component, content);
      return;
    }

    if (type === "loader") {
      createLoader(component, content);
      return;
    }

    if (type === "pricing") {
      createPricing(component, content);
      return;
    }

    if (type === "reviews") {
      createReviews(component, content);
      return;
    }

    if (type === "spacer") {
      const spacer = document.createElement("div");
      spacer.style.height = "10px";
      content.appendChild(spacer);
    }
  });

  createValidationMessage(content);
}

startQuiz();