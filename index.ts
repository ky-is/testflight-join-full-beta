import { config as dotenvConfig } from 'dotenv'

import { createTransport } from 'nodemailer'
import puppeteer from 'puppeteer-core'
import type { Page } from 'puppeteer-core'

// Setup

dotenvConfig()

const minWaitMinutes = parseInt(process.env.MIN_WAIT_MINUTES ?? '5', 10)
const rangeOfWaitMinutes = minWaitMinutes * minWaitMinutes - minWaitMinutes

let remainingAppIDs = process.env.TESTFLIGHT_APP_IDS?.split(',').filter(id => id.trim().length > 0) ?? []

// Email

async function notifyEmail(subject: string, link: string) {
	const email = process.env.EMAIL_ADDRESS
	console.log(subject, 'to', email)
	const nodemailerTransporter = createTransport({
		service: 'gmail',
		auth: {
			user: email,
			pass: process.env.EMAIL_PASSWORD,
		},
	})
	try {
		await nodemailerTransporter.sendMail({
			from: email,
			to: email,
			subject,
			text: link,
			html: `<a href="${link}">${link}</a>`,
		})
	} catch (error) {
		console.log(error)
	}
}

// Loop

async function loadPages(appIDs: string[]) {
	const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
	return Promise.all(appIDs.map(async appID => {
		const pageURL = `https://testflight.apple.com/join/${appID}`
		const page = await browser.newPage()
		await page.goto(pageURL, { waitUntil: 'domcontentloaded' })
		return [ appID, page, pageURL ] as [string, Page, string]
	}))
}

async function checkAvailability() {
	console.log(new Date().toLocaleString())
	for (const [appID, page, pageURL] of await loadPages(remainingAppIDs)) {
		const title = (await page.title()).split(' - TestFlight')[0]
		const results = await page.evaluate(() => {
			const links = Array.from(document.querySelectorAll('a'))
			return links.find(el => el.textContent?.trim().toUpperCase() === 'START TESTING')
		})
		if (results != null) {
			remainingAppIDs = remainingAppIDs.filter(id => id !== appID)
			await notifyEmail(title, pageURL)
		}
	}
	if (remainingAppIDs.length) {
		const minutesUntilUpdate = Math.random() * rangeOfWaitMinutes + minWaitMinutes
		setTimeout(checkAvailability, minutesUntilUpdate * 60 * 1000)
		console.log('Unavailable:', remainingAppIDs, 'Check again in:', `${Math.round(minutesUntilUpdate)} minutes.`)
	}
}

// Run

async function logTitlesForAppIDs() {
	console.log('Checking every', minWaitMinutes, 'to', rangeOfWaitMinutes + minWaitMinutes, 'minutes:')
	for (const [_, page, pageURL] of await loadPages(remainingAppIDs)) {
		const title = (await page.title()).split(' - TestFlight')[0]
		console.log(title.replace('Join the ', '').replace(' beta', ''), pageURL)
	}
	console.log('')
}

await logTitlesForAppIDs()

checkAvailability()
