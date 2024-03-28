const domParser = new DOMParser();
const bodyElement = document.querySelector("body");
const daysShortenings = Object.freeze({
  "Понедельник": "ПН",
  "Вторник": "ВТ",
  "Среда": "СР",
  "Четверг": "ЧТ",
  "Пятница": "ПТ",
  "Суббота": "СБ"
});

class Schedule {
  constructor(xmlDocument) {
    this.xmlDocument = xmlDocument;
  }

  get groups() {
    const groupElements = this.xmlDocument.querySelectorAll("Group");
    const groups = [];

    for (const groupElement of groupElements) {
      groups.push(new GroupSchedule(groupElement));
    }

    return groups;
  }
}

class GroupSchedule {
  constructor(group) {
    this.group = group;
  }

  get name() {
    return this.group.getAttribute("Number");
  }

  get daysShortening() {
    const dayElements = this.group.querySelectorAll("Day");
    const shortenings = [];

    for (const dayElement of dayElements) {
      shortenings.push(this.#getDayShortening(dayElement))
    }

    return shortenings;
  }

  #getDayShortening(dayElement) {
    const dayName = dayElement.getAttribute("Title");

    if (daysShortenings[dayName] !== undefined) {
      return daysShortenings[dayName];
    }
    else {
      throw new Error(`Не удалось найти сокращение для дня: ${dayName}`);
    }
  }
}

class GroupsView {
  static draw(groups) {
    this.listElement = this.#createListElement();
    this.groups = groups;

    window.history.replaceState({
      state: GroupsView.name
    }, "")

    this.#drawGroups();

    this.show();
  }

  static #createListElement() {
    const listElement = document.createElement("ul");
    listElement.classList.add("groups");
    return listElement;
  }

  static #drawGroups() {
    for (const group of this.groups) {
      const listItemElement = document.createElement("li");
      listItemElement.textContent = group.name;
      listItemElement.addEventListener("click", () => {
        window.history.pushState({
          state: GroupScheduleView.name,
          group: group.name
        }, "")
        this.hide();
        GroupScheduleView.draw(group);
      });
      this.listElement.appendChild(listItemElement);
    }
  }

  static show() {
    bodyElement.appendChild(this.listElement);
  }

  static hide() {
    if (bodyElement.contains(this.listElement)) {
      bodyElement.removeChild(this.listElement);
    }
  }
}

class GroupScheduleView {
  static draw(group) {
    this.group = group;
    this.element = this.#createElement();
    this.show();
  }

  static #createElement() {
    const element = document.createElement("div");
    element.classList.add("schedule");
    this.#createGroupTitle(element);
    this.#createDays(element);
    return element;
  }

  static #createGroupTitle(parentElement) {
    const titleElement = document.createElement("h2");
    titleElement.textContent = this.group.name;
    parentElement.appendChild(titleElement);
  }

  static #createDays(parentElement) {
    const daysElement = document.createElement("div")
    daysElement.classList.add("days");

    for (const dayShortening of this.group.daysShortening) {
      daysElement.appendChild(this.#createDay(dayShortening));
    }

    parentElement.appendChild(daysElement);
  }

  static #createDay(dayShortening) {
    const dayElement = document.createElement("button")
    dayElement.classList.add("day");
    dayElement.textContent = dayShortening;
    return dayElement;
  }

  static show() {
    bodyElement.appendChild(this.element);
  }

  static hide() {
    if (bodyElement.contains(this.element)) {
      bodyElement.removeChild(this.element);
    }
  }
}

window.addEventListener("load", async () => {
  const schedule = await tryGetSchedule();
  GroupsView.draw(schedule.groups);
});

async function tryGetSchedule() {
  const xmlString = await tryFetchScheduleXML();
  const xmlDocument = domParser.parseFromString(xmlString, "text/xml");
  return new Schedule(xmlDocument);
}

function tryFetchScheduleXML() {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open(
      "GET",
      "https://cors-proxy.cluster.fun/https://www.voenmeh.ru/templates/jd_atlanta/js/TimetableGroup46.xml"
    );

    request.send();

    request.onload = () => {
      if (request.status !== 200) {
        reject(
          `Не удалось получить расписание с сайта военмеха. Код ошибки: ${request.status}`
        );
      } else {
        resolve(request.response);
      }
    };
  });
}

window.addEventListener("popstate", (event) => {
  const { state } = event.state;

  switch (state) {
    case GroupsView.name:
      GroupScheduleView.hide();
      GroupsView.show();
      break;
    case GroupScheduleView.name:
      GroupsView.hide();
      const group = domParser.parseFromString(event.state.group, "text/xml");
      GroupScheduleView.show(group);
      break;
    default:
      throw new Error("Не удалось восстановить состояние истории")
  }
})