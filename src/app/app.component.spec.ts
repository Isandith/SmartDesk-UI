/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [provideHttpClient()],
		}).compileComponents();
	});

	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent);
		const app = fixture.componentInstance;

		expect(app).toBeTruthy();
	});

	it('should have the SmartDesk AI title', () => {
		const fixture = TestBed.createComponent(AppComponent);
		const app = fixture.componentInstance;

		expect(app.activeSession().title).toBe('New Chat');
	});

	it('should render the app shell', () => {
		const fixture = TestBed.createComponent(AppComponent);
		fixture.detectChanges();

		const compiled = fixture.nativeElement as HTMLElement;
		expect(compiled.querySelector('textarea')).toBeTruthy();
		expect(compiled.querySelector('[aria-label="Send message"]')).toBeTruthy();
	});
});
