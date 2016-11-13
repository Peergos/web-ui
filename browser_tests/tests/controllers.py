"""Controllers for interacting with the Peergos web-app."""
import abc
import time
import sys
import uuid

from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from contextlib import contextmanager
import os

# get url from environment, default to localhost:8000
PEERGOS_URL = os.environ.get("peergos_url", "http://localhost:8000")

class PeergosError(Exception):
    """Package root exception."""
    pass


def _guid():
    """Generate a random guid string."""
    return str(uuid.uuid4())


def get_driver():
    """Returns a webdriver."""
    return webdriver.Firefox()


def get_driver_on_page(url):
    """Creates a webdriver and navigates it to url."""
    driver = get_driver()
    driver.get(url)
    return driver


@contextmanager
def driver_context(url=PEERGOS_URL, screenshot_file="screenshot.png"):
    """
    context-manager that prints exception info. and creates a screenshot
    on error.

    Parameters
    ----------
    url: `str`
        Peergos web app url.
    screenshot_file: `str`
        Path to store screenshot file.
    """
    driver = get_driver_on_page(url)

    try:
        yield driver
    except Exception as e:
        print(sys.exc_info())
        driver.get_screenshot_as_file(screenshot_file)
        raise e
    finally:
        driver.quit()


def require_unique(driver, *xpaths):
    """
    Requires a collection of unique xpaths appear on a page.

    Parameters
    ----------
    driver: `WebDriver`
    xpaths: `list`
    """
    for xpath in xpaths:
        elems = driver.find_elements_by_xpath(xpath)
        count = len(elems)
        if not count == 1:
            raise PeergosError("non unique xpath {} has {} entries".format(xpath, str(count)))


class Page(object):
    '''A controller for interacting  with a `page` on the Peergos web-app.'''

    __metaclass__ = abc.ABCMeta

    def __init__(self, driver):
        self.driver = driver
        time.sleep(self._init_sleep())
        if not self._is_valid():
            raise PeergosError("invalid page " + str(self.__class__))

    @classmethod
    def _init_sleep(cls):
        """The initial time period in seconds to wait for the page  to load in the constructor."""
        return 1

    @abc.abstractmethod
    def _is_valid(self):
        """Called in the constructor to check if the page has the correct content.
        
        Returns
        -------
        bool
        """
        pass

    @property
    def d(self):
        """A short-hand for the driver attribute."""
        return self.driver

    def get_source(self):
        """Returns the page source that the driver is currently on."""
        return self.d.page_source.encode("utf-8")

    def get_unique_xpath(self, xpath):
        """
        Gets a web-element matching an xpath expression.

        Parameters
        ----------
        xpath: `str`
            An xpath selector.

        Returns
        -------
        WebElement
            The web-element on the page matching xpath.

        Raises
        ------
        PeergosError
            When there is not exactly one element matching xpath.
        """
        elems = self.d.find_elements_by_xpath(xpath)
        if not len(elems) == 1:
            raise PeergosError("non unique path {} : {}".format(xpath, str(elems)))
        return elems[0]


class LoginPage(Page):
    """The landing page."""

    def _is_valid(self):
        self.get_unique_xpath("//h2[text()='Please log in']")
        self.get_unique_xpath("//input[@id='username']")
        self.get_unique_xpath("//input[@name='password']")
        self.get_unique_xpath("//button[text()='Login']")
        return True

    def to_signup_page(self):
        """Navigate to the signup page.
        
        Returns
        -------
        SignupPage
        """
        signup = self.get_unique_xpath("//button[text()='Sign Up']")
        signup.click()
        return SignupPage(self.d)

    def login(self, username, password):
        """
        Login with user credentials.

        Returns
        -------
        FileSystemPage
            The filesystem page logged in with user credentials.
        """
        self.get_unique_xpath("//input[@id='username']").send_keys(username)
        self.get_unique_xpath("//input[@name='password']").send_keys(password)
        self.get_unique_xpath("//button[text()='Login']").click()
        return FileSystemPage(self.d, username, password)


class SignupPage(Page):
    """Page with signup inputs."""
    def _is_valid(self):
        self.get_unique_xpath("//input[@id='password2']")
        return True

    def signup(self, username=None, password=None):
        """Sign up to Peergos.

        Parameters
        ----------
        username: `str`
            Username to signup with.
            Defaults to a random guid when None.
        password: `str`
            Password to signup with.
            Defaults to a random guid when None.
            
        Returns
        -------
        FileSystemPage
            As the new user.
        """
        username_input = self.get_unique_xpath("//input[@id='username']")
        password1_input = self.get_unique_xpath("//input[@id='password1']")
        password2_input = self.get_unique_xpath("//input[@id='password2']")

        if username is None:
            username = _guid()
        if password is None:
            password = _guid()

        username_input.send_keys(username)
        password1_input.send_keys(password)
        password2_input.send_keys(password)

        self.get_unique_xpath("//button[text()='Sign up']").click()

        return FileSystemPage(self.d, username, password)


class FileSystemPage(Page):
    """Filesystem view page in grid mode."""
    def __init__(self, driver, username, password):
        super(FileSystemPage, self).__init__(driver)
        self.username = username
        self.password = password

    def _is_valid(self):
        xpaths = [
            "//button[@id='logoutButton']",
            "//li[@id='homeButton']",
            "//li[@id='alternateViewButton']",
            "//li[@id='homeButton']",
            "//li[@id='userOptionsButton']",
            "//a[@id='pathSpan']",
        ]
        require_unique(self.d, *xpaths)
        return True

    def go_home(self):
        self.get_unique_xpath("//li[@id='homeButton']").click()
        return FileSystemPage(self.d, self.username, self.password)

    def logout(self):
        self.get_unique_xpath("//button[@id='logoutButton']").click()
        self.get_unique_xpath("//a[text()='Log out']").click()
        return LoginPage(self.d)

    @classmethod
    def _init_sleep(cls):
        return 5
