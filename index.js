class NavigatorElement extends HTMLElement {
  constructor() {
    super();

    this.groupsElement = elementBuilder.build({ tagName: "ul", classList: ["list"] });
    this.loaderElement = elementBuilder.build({ textContent: "Загрузка..." });

    window.addEventListener("popstate", (event) => this.#changeState(event.state));
  }

  connectedCallback() {
    this.appendChild(this.loaderElement);
    this.#tryGetGroupsSchedule();
  }

  async #tryGetGroupsSchedule() {
    this.schedule = await VoenmehScheduleFetcher.tryGetGroupsSchedule();
    for (const group of this.schedule.groups) {
      elementBuilder.build({ prototype: elementsPrototypes.groupListItem, parent: this.groupsElement, data: { group: group.name }, onclick: () => this.navigateToGroupWithName(group.name) });
    }
    this.navigateToGroupsList();
  }

  navigateToGroupsList() {
    const state = {
      state: navigatorStates.groupsList
    };
    window.history.replaceState(state, "");
    this.#changeState(state);
  }

  navigateToGroupWithName(name) {
    const state = {
      state: navigatorStates.group,
      name
    }
    window.history.pushState(state, "");
    this.#changeState(state);
  }

  #changeState(stateInfo) {
    const { state } = stateInfo;

    this.innerHTML = "";

    switch (state) {
      case navigatorStates.groupsList:
        this.appendChild(this.groupsElement);
        break;
      case navigatorStates.group:
        const { name } = stateInfo;
        this.groupElement = elementBuilder.build({ tagName: GroupElement.customComponentTagName, parent: this, fields: { group: this.schedule.getGroupByName(name) } });
        break;
      default:
        throw new Error(`Не удалось восстановить состояние истории для ${element}`)
    }
  }

  static get customComponentTagName() {
    return "schedule-navigator";
  }
}

class GroupElement extends HTMLElement {
  #currentDay;
  #currentWeekParity = 1;

  constructor() {
    super();

    this.titleElement = elementBuilder.build({ tagName: "h2" });
    this.weekParityToggleElement = elementBuilder.build({ prototype: elementsPrototypes.weekParityToggle, onclick: () => this.currentWeekParity = this.currentWeekParity === 1 ? 2 : 1 });
    this.dayScheduleElement = elementBuilder.build({ prototype: elementsPrototypes.daySchedule, fields: { parity: this.currentWeekParity } });
    this.daysElement = elementBuilder.build({ tagName: DaysElement.customComponentTagName });
    this.panelElement = elementBuilder.build({ prototype: elementsPrototypes.panel, children: [this.weekParityToggleElement, this.daysElement] });
  }

  connectedCallback() {
    this.appendChild(this.titleElement);
    this.appendChild(this.dayScheduleElement);
    this.appendChild(this.panelElement);
  }

  set group(group) {
    this.groupElement = group;
    this.titleElement.textContent = group.name;
    this.currentDay = this.groupElement.days[0];
    this.currentWeekParity = 1;
    this.#updateDaysElement();
  }

  #updateDaysElement() {
    this.daysElement.days = this.groupElement.days.map(day => ({
      day,
      callback: () => {
        this.currentDay = day
        this.daysElement.currentDay = day;
      }
    }))
    this.daysElement.currentDay = this.currentDay;
  }

  get currentWeekParity() {
    return this.#currentWeekParity;
  }

  set currentWeekParity(parityNumber) {
    this.#currentWeekParity = parityNumber;
    this.weekParityToggleElement.textContent = weekParityButtonText[parityNumber];
    this.dayScheduleElement.parity = parityNumber;
  }

  get currentDay() {
    return this.#currentDay;
  }

  set currentDay(currentDay) {
    this.dayScheduleElement.schedule = this.groupElement.getDaySchedule(currentDay);
    this.#currentDay = currentDay;
  }

  static get customComponentTagName() {
    return "schedule-group";
  }
}

class DaysElement extends HTMLElement {
  #currentDay;
  #daysElements = {};

  connectedCallback() {
    this.#daysElements = {};
    for (const { day, callback } of this.daysObjects) {
      this.#daysElements[day] = elementBuilder.build({ prototype: elementsPrototypes.day, parent: this, textContent: daysShortenings[day], onclick: callback });
    }
    this.#updateActiveDay();
  }

  set days(days) {
    this.daysObjects = days;
  }

  get currentDay() {
    return this.#currentDay;
  }

  set currentDay(day) {
    this.#currentDay = day;
    this.#updateActiveDay();
  }

  #updateActiveDay() {
    const previousActiveDay = this.querySelector(".day_active");

    if (previousActiveDay !== null) {
      previousActiveDay.classList.remove("day_active");
    }

    const currentActiveDay = this.#daysElements[this.currentDay];

    if (currentActiveDay !== undefined) {
      this.#daysElements[this.currentDay].classList.add("day_active");
    }
  }

  static get customComponentTagName() {
    return "schedule-days";
  }
}

class DayScheduleTableElement extends HTMLTableElement {
  #parity = 1;

  constructor() {
    super();

    this.resizeObserver = this.#createResizeObserver();

    this.body = elementBuilder.build({ tagName: "tbody", parent: this });

    this.classList.add("scheduleDayTable");
  }

  #createResizeObserver() {
    const resizeObserver = new ResizeObserver(() => this.#updateResizableObjects());
    resizeObserver.observe(this);
    return resizeObserver;
  }

  set schedule(schedule) {
    this.scheduleObject = schedule;
    this.#updateSchedule();
    this.#updateResizableObjects();
  }

  get parity() {
    return this.#parity;
  }

  set parity(parity) {
    this.#parity = parity;
    this.#updateSchedule();
    this.#updateResizableObjects();
  }

  #updateResizableObjects() {
    this.#updateLessonsHeight();
    this.#updateTimePosition();
  }

  #updateLessonsHeight() {
    const lessons = this.querySelectorAll(LessonElement.customComponentTagName);

    if (this.rowElements === undefined) {
      return;
    }

    const rowKey = Object.keys(this.rowElements)[0];
    for (const lesson of lessons) {
      lesson.style.height = `${this.rowElements[rowKey].clientHeight * 18}px`;
    }
  }

  #updateTimePosition() {
    const timeElements = this.querySelectorAll(".timeRow:not(:first-child) .time")

    if (this.rowElements === undefined) {
      return;
    }

    const rowKey = Object.keys(this.rowElements)[0];
    for (const timeElement of timeElements) {
      timeElement.style.top = `${-5 - this.rowElements[rowKey].clientHeight}px`
    }
  }

  #updateSchedule() {
    if (this.scheduleObject === undefined) {
      return;
    }

    const weekLessons = this.parity === 1 ? this.scheduleObject.oddWeek : this.scheduleObject.evenWeek;
    if (weekLessons.length === 0) {
      this.body.innerHTML = "В этот день нет занятий";
      return;
    }
    const startTime = Time.parse(weekLessons[0].time).getTimeWithMinutes(0);
    const endTime = Time.parse(weekLessons.at(-1).time).getPlusHoursAndMinutesTime(1, 30);
    this.#createTableForSchedule(startTime, endTime);
    this.#fillTimeColumns(startTime, endTime);
    for (const lesson of weekLessons) {
      this.rowElements[Time.parse(lesson.time).toString()].lesson = lesson;
    }
  }

  #createTableForSchedule(startTime, endTime) {
    this.rowElements = {};
    this.body.innerHTML = ""; // TODO: скрывать ненужные строки
    let currentTime = startTime;

    while (currentTime.time <= endTime.time) {
      this.rowElements[currentTime.toString()] = elementBuilder.build({ tagName: "tr", is: DayScheduleTableRowElement.customComponentTagName, parent: this.body })
      currentTime = currentTime.getPlusMinutesTime(5);
    }
  }

  #fillTimeColumns(startTime, endTime) {
    let currentTime = startTime;

    while (currentTime.getHours() <= endTime.getHours()) {
      this.#setRowDateTimeString(currentTime.toString());
      currentTime = currentTime.getPlusHoursTime(1);
    }
  }

  #setRowDateTimeString(timeString) {
    this.rowElements[timeString].dateTimeString = timeString;
  }

  static get customComponentTagName() {
    return "schedule-day-table";
  }
}

class DayScheduleTableRowElement extends HTMLTableRowElement {
  constructor() {
    super();

    this.timeColumn = elementBuilder.build({ tagName: "td", classList: ["timeColumn"], parent: this });
    this.scheduleColumn = elementBuilder.build({ tagName: "td", classList: ["scheduleColumn"], parent: this });

    this.classList.add("timeRow");
  }

  set lesson(lesson) {
    this.lessonElement = elementBuilder.build({ tagName: LessonElement.customComponentTagName, fields: { lesson }, parent: this.scheduleColumn });
  }

  set dateTimeString(timeString) {
    elementBuilder.build({ tagName: "span", classList: ["time"], textContent: timeString, parent: this.timeColumn });
  }

  static get customComponentTagName() {
    return "schedule-day-tr";
  }
}

class LessonElement extends HTMLElement {
  connectedCallback() {
    elementBuilder.build({
      parent: this, children: [
        elementBuilder.build({ textContent: this.#getLessonIntervalString(this.lessonObject.time) }),
        elementBuilder.build({ textContent: this.lessonObject.classRoom })
      ]
    });
    elementBuilder.build({ parent: this, textContent: this.lessonObject.discipline });
    elementBuilder.build({ parent: this, textContent: this.lessonObject.lecturers.join(", ") });
  }

  #getLessonIntervalString(lessonStartTime) {
    return `${lessonStartTime} - ${Time.parse(lessonStartTime).getPlusHoursAndMinutesTime(1, 30)}`;
  }

  set lesson(lesson) {
    this.lessonObject = lesson;
  }

  static get dateTime() {
    return Time.parse(this.lessonObject.time);
  }

  static get customComponentTagName() {
    return "schedule-lesson";
  }
}

class Time {
  #minutes = 0;

  constructor(hours, minutes) {
    this.#minutes = this.getDayMinutes(hours * 60 + minutes);
  }

  static parse(dateTimeString) {
    const [hours, minutes] = dateTimeString.split(":");
    return new Time(parseInt(hours), parseInt(minutes));
  }

  static fromTime(time) {
    return new Time(Math.trunc(time / 60), time % 60);
  }

  get time() {
    return this.#minutes;
  }

  toString() {
    return `${this.#formatNumber(this.getHours())}:${this.#formatNumber(this.getMinutes())}`;
  }

  #formatNumber(number) {
    const numberString = number.toString();

    if (numberString.length === 2) {
      return numberString;
    }
    else {
      return '0' + numberString;
    }
  }

  getTimeWithMinutes(minutes) {
    if (minutes >= 60) {
      return Time.fromTime(this.getHours() * 60);
    }
    else {
      return Time.fromTime(this.getHours() * 60 + minutes);
    }
  }

  getHours() {
    return Math.trunc(this.#minutes / 60);
  }

  getTimeWithHours(hours) {
    if (hours >= 24) {
      return Time.fromTime(0);
    }
    else {
      return Time.fromTime(hours * 60 + this.getMinutes());
    }
  }

  getMinutes() {
    return this.#minutes % 60;
  }

  getPlusHoursAndMinutesTime(addendHours, addendMinutes) {
    return this.getPlusMinutesTime(addendHours * 60 + addendMinutes);
  }

  getPlusHoursTime(addend) {
    return this.getPlusMinutesTime(addend * 60);
  }

  getPlusMinutesTime(addend) {
    let time = this.getDayMinutes(this.#minutes + addend);
    return Time.fromTime(time);
  }

  getDayMinutes(minutes) {
    const minutesInDay = 24 * 60;
    if (minutes >= minutesInDay) {
      return minutes % minutesInDay;
    }
    else if (minutes < 0) {
      return 0;
    }
    else {
      return minutes;
    }
  }
}

class VoenmehScheduleFetcher {
  static async tryGetGroupsSchedule() {
    const xmlString = await this.#tryFetchScheduleXML();
    const xmlDocument = domParser.parseFromString(xmlString, "text/xml");
    return new Schedule(xmlDocument);
  }

  static #tryFetchScheduleXML() {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();

      request.open(
        "GET",
        this.#addCorsProxyToURL("https://www.voenmeh.ru/templates/jd_atlanta/js/TimetableGroup46.xml")
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

  /**
   * CORS ругается при попытке получения данных с сайтов, у которых другой домен.
   * Одним из способов является использование CORS-proxy: https://github.com/AverageMarcus/cors-proxy
   */
  static #addCorsProxyToURL(url) {
    return "https://cors-proxy.cluster.fun/" + "https://www.voenmeh.ru/templates/jd_atlanta/js/TimetableGroup46.xml";
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
      if (!this.#isGroupElementScheduleEmpty(groupElement)) {
        groups.push(new GroupSchedule(groupElement));
      }
    }

    return groups;
  }

  #isGroupElementScheduleEmpty(groupElement) {
    return groupElement.childElementCount === 0;
  }

  getGroupByName(number) {
    const xmlNode = this.xmlDocument.querySelector(`Group[Number='${number}']`);
    return new GroupSchedule(xmlNode);
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
    const dayNames = this.days;
    const shortenings = [];
    for (const day of dayNames) {
      shortenings.push(this.#getDayShortening(day))
    }
    return shortenings;
  }

  #getDayShortening(day) {
    if (daysShortenings[day] !== undefined) {
      return daysShortenings[day];
    }
    else {
      throw new Error(`Не удалось найти сокращение для дня: ${day}`);
    }
  }

  get days() {
    const dayElements = this.group.querySelectorAll("Day");
    const dayNames = [];
    for (const dayElement of dayElements) {
      dayNames.push(dayElement.getAttribute("Title"));
    }
    return dayNames;
  }

  getDaySchedule(dayName) {
    return new DaySchedule(this.group.querySelector(`Day[Title=${dayName}]`));
  }
}

class DaySchedule {
  constructor(day) {
    this.day = day;
  }

  get evenWeek() {
    const schedule = [];
    for (const lesson of this.#evenLessons) {
      schedule.push(this.#parseLessonXML(lesson));
    }
    return schedule;
  }

  get #evenLessons() {
    return this.#lessons.filter(lesson => lesson.querySelector("WeekCode").textContent === "2");
  }

  get oddWeek() {
    const schedule = [];
    for (const lesson of this.#oddLessons) {
      schedule.push(this.#parseLessonXML(lesson));
    }
    return schedule;
  }

  get #oddLessons() {
    return this.#lessons.filter(lesson => lesson.querySelector("WeekCode").textContent === "1");
  }

  get #lessons() {
    return [...this.day.querySelectorAll("Lesson")];
  }

  #parseLessonXML(lesson) {
    return {
      time: this.#parseLessonTime(lesson),
      discipline: lesson.querySelector("Discipline").textContent,
      lecturers: this.#parseLecturers(lesson),
      classRoom: lesson.querySelector("Classroom").textContent.trim().slice(0, -1)
    };
  }

  #parseLessonTime(lesson) {
    const timeElement = lesson.querySelector("Time");
    return timeElement.textContent.split(" ")[0];
  }

  #parseLecturers(lesson) {
    const lecturers = [];
    const lecturerElements = lesson.querySelectorAll("Lecturer");
    for (const lecturerElement of lecturerElements) {
      lecturers.push(lecturerElement.querySelector("ShortName").textContent)
    }
    return lecturers;
  }
}


class elementBuilder {
  static build({ prototype, ...props } = { tagName: "div" }) {
    if (prototype === undefined) {
      prototype = {};
    }
    const { tagName, is, classList, parent, data, fields, children, onclick, textContent } = { ...{ tagName: "div" }, ...prototype, ...props };
    const element = document.createElement(tagName, { is });
    element.onclick = onclick;
    this.#setClassList(element, classList);
    this.#setTextContent(element, textContent);
    this.#setData(element, data);
    this.#setFields(element, fields);
    parent?.appendChild(element);
    this.#setChildren(element, children);
    return element;
  }

  static #setClassList(element, classList = []) {
    if (classList.length !== 0) {
      element.classList.add(...classList);
    }
  }

  static #setTextContent(element, textContent = "") {
    if (textContent.length !== 0) {
      element.textContent = textContent;
    }
  }

  static #setData(element, data = {}) {
    for (const [key, value] of Object.entries(data)) {
      element.dataset[key] = value;
    }
  }

  static #setFields(element, fields = {}) {
    for (const [key, value] of Object.entries(fields)) {
      element[key] = value;
    }
  }

  static #setChildren(element, children = []) {
    for (const child of children) {
      element.appendChild(child);
    }
  }
}

customElements.define(NavigatorElement.customComponentTagName, NavigatorElement);
customElements.define(GroupElement.customComponentTagName, GroupElement);
customElements.define(DaysElement.customComponentTagName, DaysElement);
customElements.define(DayScheduleTableElement.customComponentTagName, DayScheduleTableElement, { extends: "table" });
customElements.define(DayScheduleTableRowElement.customComponentTagName, DayScheduleTableRowElement, { extends: "tr" });
customElements.define(LessonElement.customComponentTagName, LessonElement);

const navigatorElement = elementBuilder.build({ tagName: NavigatorElement.customComponentTagName });
const domParser = new DOMParser();
const bodyElement = document.querySelector("body");
const days = Object.freeze({
  monday: "Понедельник",
  tuesday: "Вторник",
  wednesday: "Среда",
  thursday: "Четверг",
  friday: "Пятница",
  saturday: "Суббота"
});
const daysShortenings = Object.freeze({
  "Понедельник": "ПН",
  "Вторник": "ВТ",
  "Среда": "СР",
  "Четверг": "ЧТ",
  "Пятница": "ПТ",
  "Суббота": "СБ"
});
const weekParityButtonText = Object.freeze({
  1: "Нечетная неделя",
  2: "Четная неделя"
});
const navigatorStates = Object.freeze({
  loading: "loading",
  groupsList: "groupsList",
  group: GroupElement.customComponentTagName
});
const elementsPrototypes = Object.freeze({
  groupListItem: Object.freeze({ tagName: "div", classList: ["groupListItem"] }),
  weekParityToggle: Object.freeze({ tagName: "button", classList: ["weekParityToggle"], textContent: weekParityButtonText[this.currentWeekParity] }),
  daySchedule: Object.freeze({ tagName: "table", is: DayScheduleTableElement.customComponentTagName }),
  panel: Object.freeze({ tagName: "div", classList: ["panel"] }),
  day: Object.freeze({ tagName: "button", classList: ["day"] })
});

bodyElement.appendChild(navigatorElement);