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

class NavigatorElement extends HTMLElement {
  constructor() {
    super();
    this.#addHistoryChangeListener();
  }

  #addHistoryChangeListener() {
    window.addEventListener("popstate", (event) => {
      const { element } = event.state;

      switch (element) {
        case GroupsListElement.tagName:
          this.removeChild(this.groupElement);
          this.appendChild(this.groupsElement);
          break;
        case GroupElement.tagName:
          const { group } = event.state;
          this.#setGroupElement(this.schedule.getGroupByNumber(group));
          break;
        default:
          throw new Error("Не удалось восстановить состояние истории")
      }
    })
  }

  connectedCallback() {
    window.history.replaceState({
      element: GroupsListElement.tagName
    }, "");


    this.groupsElement = document.createElement(GroupsListElement.tagName);
    this.appendChild(this.groupsElement);

    this.#tryGetSchedule();
  }

  async #tryGetSchedule() {
    this.schedule = await tryGetSchedule();
    this.groupsElement.groups = this.schedule.groups;
  }

  navigateToGroup(group) {
    window.history.pushState({
      element: GroupElement.tagName,
      group: group.name
    }, "")

    this.#setGroupElement(group);
  }

  #setGroupElement(group) {
    this.groupElement = document.createElement(GroupElement.tagName);
    this.removeChild(this.groupsElement);
    this.appendChild(this.groupElement);
    this.groupElement.group = group;
  }

  static get tagName() {
    return "schedule-navigator";
  }
}

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

  getGroupByNumber(number) {
    const xmlNode = this.xmlDocument.querySelector(`Group[Number='${number}']`);
    return new GroupSchedule(xmlNode);
  }
}

class GroupsListElement extends HTMLElement {
  set groups(groups) {
    this.groupsElements = groups;
    this.connectedCallback()
  }

  connectedCallback() {
    if (this.groupsElements === undefined) {
      this.innerHTML = "Загрузка групп..."
    }
    else {
      this.#createGroupsElements();
    }
  }

  #createGroupsElements() {
    this.innerHTML = "";
    for (const group of this.groupsElements) {
      const groupElement = document.createElement(GroupListItemElement.tagName);
      groupElement.group = group;
      this.appendChild(groupElement);
    }
  }

  static get tagName() {
    return "schedule-group-list";
  }
}

class GroupListItemElement extends HTMLElement {
  set group(group) {
    this.textContent = group.name;
    this.addEventListener("click", () => {
      navigatorElement.navigateToGroup(group);
    });
  }

  static get tagName() {
    return "schedule-group-list-item";
  }
}

class GroupElement extends HTMLElement {
  set group(group) {
    this.groupElement = group;
    this.connectedCallback();
  }

  connectedCallback() {
    if (this.groupElement === undefined) {
      this.innerHTML = "Загрузка группы..."
    }
    else {
      this.#createElement();
    }
  }

  #createElement() {
    this.innerHTML = "";
    this.#initTitle();
    this.#initDaysElement();
    this.#initDayScheduleElement();
  }

  #initTitle() {
    const titleElement = document.createElement("h2");
    titleElement.textContent = this.groupElement.name;
    this.appendChild(titleElement);
  }

  #initDaysElement() {
    this.daysElement = document.createElement(DaysElement.tagName);
    this.appendChild(this.daysElement);
    this.daysElement.daysShortenings = this.groupElement.daysShortenings;
  }

  #initDayScheduleElement() {
    this.dayScheduleElement = document.createElement("table", { is: DayScheduleTableElement.customComponentTagName });
    this.appendChild(this.dayScheduleElement);
  }

  static get tagName() {
    return "schedule-group";
  }
}

class GroupSchedule {
  constructor(group) {
    this.group = group;
  }

  get name() {
    return this.group.getAttribute("Number");
  }

  get daysShortenings() {
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

class DaysElement extends HTMLElement {
  set daysShortenings(daysShortenings) {
    for (const dayShortening of daysShortenings) {
      this.appendChild(this.#createDay(dayShortening));
    }
  }

  #createDay(dayShortening) {
    const dayElement = document.createElement("button")
    dayElement.classList.add("day");
    dayElement.textContent = dayShortening;
    return dayElement;
  }

  static get tagName() {
    return "schedule-days";
  }
}

class DayScheduleTableElement extends HTMLTableElement {
  ROWS_COUNT = 180;

  constructor() {
    super();

    this.rowElements = [];

    this.classList.add("scheduleDayTable");
  }

  connectedCallback() {
    this.body = this.#createBody();
  }

  #createBody() {
    const body = document.createElement("tbody");
    for (let i = 0; i < this.ROWS_COUNT; i++) {
      body.appendChild(this.#createRow(body));
    }
    this.#fillTimeColumn();
    this.appendChild(body);
    return body;
  }

  #createRow(tableBody) {
    const row = document.createElement("tr", { is: DayScheduleTableRowElement.customComponentTagName })
    this.rowElements.push(row);
    tableBody.appendChild(row);
    return row;
  }

  #fillTimeColumn() {
    const dateTime = new DateTime(9, 0)

    for (let i = 11; i < this.ROWS_COUNT - 1; i += 12, dateTime.plusHours(1)) {
      this.rowElements[i].dateTimeString = dateTime.toString();
    }
  }

  static get customComponentTagName() {
    return "schedule-day-table";
  }
}

class DayScheduleTableRowElement extends HTMLTableRowElement {
  constructor() {
    super();

    this.appendChild(this.#createTimeColumn());
    this.appendChild(this.#createScheduleColumn());
  }

  #createTimeColumn() {
    this.timeColumn = document.createElement("td");
    this.timeColumn.classList.add("timeColumn");
    return this.timeColumn;
  }

  #createScheduleColumn() {
    this.scheduleColumn = document.createElement("td");
    this.scheduleColumn.classList.add("scheduleColumn");
    return this.scheduleColumn;
  }

  set dateTimeString(dateTimeString) {
    const timeElement = document.createElement("span");
    timeElement.classList.add("time");
    timeElement.textContent = dateTimeString;
    this.timeColumn.appendChild(timeElement);
  }

  static get customComponentTagName() {
    return "schedule-day-tr";
  }
}

class DateTime {
  constructor(hours, minutes) {
    this.date = new Date(2000, 1, 1, hours, minutes, 0);
  }

  plusHours(addend) {
    this.date.setHours(this.hours + addend);
  }

  get hours() {
    return this.date.getHours();
  }

  toString() {
    return this.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
}

customElements.define(NavigatorElement.tagName, NavigatorElement);
customElements.define(GroupsListElement.tagName, GroupsListElement);
customElements.define(GroupListItemElement.tagName, GroupListItemElement);
customElements.define(GroupElement.tagName, GroupElement);
customElements.define(DaysElement.tagName, DaysElement);
customElements.define(DayScheduleTableElement.customComponentTagName, DayScheduleTableElement, { extends: "table" });
customElements.define(DayScheduleTableRowElement.customComponentTagName, DayScheduleTableRowElement, { extends: "tr" });

const navigatorElement = document.createElement(NavigatorElement.tagName);

bodyElement.appendChild(navigatorElement);

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
