import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { workspaceCacheTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import axios from 'axios';

@Injectable()
export class GreythrService {
  private readonly logger = new Logger(GreythrService.name);

  constructor(private readonly db: DatabaseService) {}

  async getCredentials() {
    const records = await this.db.db
      .select()
      .from(workspaceCacheTable)
      .where(eq(workspaceCacheTable.id, 'greythr_creds'));
    
    if (records.length > 0 && records[0].rawJson) {
      try {
        return JSON.parse(records[0].rawJson);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async saveCredentials(username?: string, password?: string) {
    const creds = JSON.stringify({ username, password });
    const now = new Date().toISOString();
    
    await this.db.db
      .insert(workspaceCacheTable)
      .values({
        id: 'greythr_creds',
        name: 'greythr_creds',
        rawJson: creds,
        syncedAt: now,
      })
      .onConflictDoUpdate({
        target: workspaceCacheTable.id,
        set: {
          rawJson: creds,
          syncedAt: now,
          updatedAt: now,
        },
      });
  }

  async syncGreythr() {
    const creds = await this.getCredentials();
    if (!creds || !creds.username || !creds.password) {
      throw new Error('Greythr credentials not configured.');
    }

    this.logger.log('Logging into Greythr manually...');
    const options = new chrome.Options();
    options.addArguments(
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    );

    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    let cookies = [];

    try {
      await driver.get('https://smartshiphub.greythr.com/uas/portal/auth/login');
      await driver.wait(until.elementLocated(By.id('username')), 10000);
      await driver.findElement(By.id('username')).sendKeys(creds.username);
      await driver.wait(until.elementLocated(By.id('password')), 10000);
      await driver.findElement(By.id('password')).sendKeys(creds.password, Key.RETURN);
      await driver.wait(until.urlContains('/home'), 10000);
      this.logger.log('Login successful!');
      cookies = await driver.manage().getCookies();
    } catch (err: any) {
      this.logger.error(`Error during login: ${err.message}`);
      throw new Error('Failed to login to Greythr. Check credentials.');
    } finally {
      await driver.quit();
    }

    // Fetch daily data for the last 7 days
    const cookieHeader = cookies
      .map((cookie: any) => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });

    try {
      const results = await Promise.all(
        dates.map(date => 
          axios.get(
            `https://smartshiphub.greythr.com/latte/v3/attendance/info/6/day?attendanceDate=${date}`,
            {
              headers: {
                Cookie: cookieHeader,
                'User-Agent': 'Mozilla/5.0',
                accept: 'application/json',
              },
            }
          ).then(res => ({ date, data: res.data }))
        )
      );

      const dailyDataMap: Record<string, string> = {};
      for (const res of results) {
        if (res.data && res.data.empExtInfo) {
           const info = res.data.empExtInfo;
           // The user specifically wants the active swipe time, which is productionHours (e.g. 478 mins = 07:58)
           // If productionHours is not available, fallback to actualWorkHrs or totalWorkHrs
           const timeToUse = info.productionHours ?? info.actualWorkHrs ?? info.totalWorkHrs;
           if (timeToUse != null) {
              dailyDataMap[res.date] = String(timeToUse);
           }
        }
      }

      // 3) Fetch realtime swipe data for today's live time
      let realtimeData = null;
      try {
        const swipeResponse = await axios.get(
          `https://smartshiphub.greythr.com/v3/api/attendance/swipes`,
          {
            headers: {
              Cookie: cookieHeader,
              'User-Agent': 'Mozilla/5.0',
            },
          }
        );
        
        if (swipeResponse.data && Array.isArray(swipeResponse.data)) {
           // Apply the realtime calculation logic
           const swipeData = swipeResponse.data;
           swipeData.sort((a: any, b: any) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime());
           
           let totalSeconds = 0;
           let lastInTime: Date | null = null;
           let currentStatus = 0;

           swipeData.forEach((swipe: any) => {
             const punchTime = new Date(swipe.punchTime);
             if (swipe.inOutIndicator === 1) {
               lastInTime = punchTime;
               currentStatus = 1;
             } else if (swipe.inOutIndicator === 0 && lastInTime) {
               totalSeconds += (punchTime.getTime() - lastInTime.getTime()) / 1000;
               lastInTime = null;
               currentStatus = 0;
             }
           });

           const now = new Date();
           if (currentStatus === 1 && lastInTime) {
             let lastPunchTime = new Date(swipeData[swipeData.length - 1].punchTime + 'Z');
             totalSeconds += (now.getTime() - lastPunchTime.getTime()) / 1000;
           }

           const totalMinutes = Math.floor(totalSeconds / 60);
           const totalHoursDisplay = `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
           
           realtimeData = {
              totalHours: totalHoursDisplay,
              currentStatus: currentStatus ? "IN" : "OUT"
           };
        }
      } catch (err: any) {
        this.logger.warn(`Could not fetch swipe data: ${err.message}`);
      }

      return { dailyData: dailyDataMap, realtime: realtimeData };
    } catch (err: any) {
      this.logger.error(`Error fetching daily attendance: ${err.message}`);
      throw new Error('Failed to fetch attendance data.');
    }
  }
}
