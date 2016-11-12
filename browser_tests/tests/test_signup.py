import os
from controllers import *
# get url from environment, default to localhost:8000
PEERGOS_URL = os.environ.get("peergos_url", "http://localhost:8000")

@contextmanager
def screenshot_or_error(screenshot_file="screenshot.png"):
    """
    context-manager that prints exception info. and creates a screenshot
    on error.

    Parameters
    ----------
    driver: `WebDriver`
        Selenium WebDriver. 
    screenshot_file: `str`
        Path to store screenshot file.
    """
    driver = get_driver_on_page(PEERGOS_URL)
    try:
        yield driver
    except Exception as e:
        print(sys.exc_info())
        driver.get_screenshot_as_file(screenshot_file)
        raise e
    finally:
        driver.quit()

def test_login_page():
    with screenshot_or_error() as driver:
        LandingPage(driver)


def test_signup():
    with screenshot_or_error() as driver:
        landing_page = LandingPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup()
        
        logout = filesystem_page.get_unique_xpath("//button[@id='logoutButton']") 
        assert filesystem_page.username in logout.text

        
        



