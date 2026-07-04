import { Plugin } from "obsidian";

export default class PersonalOSPlugin extends Plugin {
	async onload() {
		console.log("Personal OS: loading plugin");
	}

	onunload() {
		console.log("Personal OS: unloading plugin");
	}
}
