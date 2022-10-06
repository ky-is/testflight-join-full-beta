const MIN_WAIT_MINUTES = 6

import { config as dotenvConfig } from 'dotenv'

import { createTransport } from 'nodemailer'
import puppeteer from 'puppeteer-core'

// Setup

dotenvConfig()

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })

// Loop

async function checkAvailability() {
	const pageURL = `https://testflight.apple.com/join/${process.env.TESTFLIGHT_APP_ID}`
	console.log(new Date().toLocaleString(), pageURL)
	const page = await browser.newPage()
	await page.goto(pageURL, { waitUntil: 'domcontentloaded' })
	const results = await page.evaluate(() => {
		const links = Array.from(document.querySelectorAll('a'))
		return links.find(el => el.textContent?.toUpperCase() === 'START TESTING')
	})
	if (results != null) {
		const email = process.env.EMAIL_ADDRESS
		const title = (await page.title()).split(' - TestFlight')[0]
		console.log(title, 'to', email)

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
				subject: title,
				text: pageURL,
				html: `<a href="${pageURL}">${pageURL}</a>`,
			})
		} catch (error) {
			console.log(error)
		}
	} else {
		const minutesUntilUpdate = Math.random() * (MIN_WAIT_MINUTES * MIN_WAIT_MINUTES - MIN_WAIT_MINUTES) + MIN_WAIT_MINUTES
		setTimeout(checkAvailability, minutesUntilUpdate * 60 * 1000)
		console.log('Unavailable. Check again in:', `${Math.round(minutesUntilUpdate)} minutes.`)
	}
}

// Run

checkAvailability()
