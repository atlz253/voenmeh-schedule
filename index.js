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
    this.#initDayScheduleElement();
    this.#initDaysElement();
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
    this.dayScheduleElement.schedule = this.groupElement.getDaySchedule(days.monday)
    this.appendChild(this.dayScheduleElement);
  }

  static get tagName() {
    return "schedule-group";
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
  ROWS_COUNT = 168;

  constructor() {
    super();

    this.rowElements = {};
    this.lessonElements = [];

    this.body = this.#createBody();

    this.classList.add("scheduleDayTable");
  }

  #createBody() {
    const body = document.createElement("tbody");
    this.appendChild(body);
    return body;
  }

  set schedule(schedule) {
    const startTime = Time.parse(schedule.oddWeek[0].time).getTimeWithMinutes(0);
    const endTime = Time.parse(schedule.oddWeek.at(-1).time).getPlusHoursAndMinutesTime(1, 30);
    this.#createTableForSchedule(startTime, endTime);
    this.#fillTimeColumns(startTime, endTime);
    for (const lesson of schedule.oddWeek) {
      this.rowElements[Time.parse(lesson.time).toString()].lesson = lesson;
    }
  }

  #createTableForSchedule(startTime, endTime) {
    let currentTime = startTime;

    while (currentTime.time <= endTime.time) {
      this.body.appendChild(this.#createRow(currentTime.toString()));
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

  #createRow(time) {
    const row = document.createElement("tr", { is: DayScheduleTableRowElement.customComponentTagName })
    this.rowElements[time] = row;
    this.body.appendChild(row);
    return row;
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

    this.classList.add("timeRow");
  }

  connectedCallback() {
    if (this.lessonElement !== undefined) {
      // this.lessonElement.style.height = `${this.clientHeight * 12}px`;
    }
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

  set lesson(lesson) {
    this.lessonElement = document.createElement(LessonElement.customComponentTagName);
    this.lessonElement.lesson = lesson;
    this.scheduleColumn.appendChild(this.lessonElement);
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

class LessonElement extends HTMLElement {
  connectedCallback() {
    this.classList.add("lesson");
  }

  set lesson(lesson) {
    this.lessonObject = lesson;
    this.textContent = "Hello world!";
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

  getDaySchedule(dayName) {
    return new DaySchedule(this.group.querySelector(`Day[Title=${dayName}]`));
  }
}

class DaySchedule {
  constructor(day) {
    this.day = day;
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
      classRoom: lesson.querySelector("Classroom").textContent
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

customElements.define(NavigatorElement.tagName, NavigatorElement);
customElements.define(GroupsListElement.tagName, GroupsListElement);
customElements.define(GroupListItemElement.tagName, GroupListItemElement);
customElements.define(GroupElement.tagName, GroupElement);
customElements.define(DaysElement.tagName, DaysElement);
customElements.define(DayScheduleTableElement.customComponentTagName, DayScheduleTableElement, { extends: "table" });
customElements.define(DayScheduleTableRowElement.customComponentTagName, DayScheduleTableRowElement, { extends: "tr" });
customElements.define(LessonElement.customComponentTagName, LessonElement);

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
