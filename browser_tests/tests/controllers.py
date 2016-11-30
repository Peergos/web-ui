"""Controllers for interacting with the Peergos web-app."""
import abc
import time
import sys
import uuid
from contextlib import contextmanager
import os

from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains

# get url from environment, default to localhost:8000
PEERGOS_URL = os.environ.get("peergos_url", "http://localhost:8000")

class PeergosError(Exception):
    """Package root exception."""
    pass


def guid():
    """Generate a random guid string."""
    return str(uuid.uuid4())


def get_driver():
    """Returns a webdriver."""
    return webdriver.Chrome()


def get_driver_on_page(url):
    """Creates a webdriver and navigates it to url."""
    driver = get_driver()
    driver.get(url)
    return driver

@contextmanager
def signup_to_homedir(username=None, password=None):
    """Signs up a new user, clicks on user directory.
    Parameters
    ----------
    username: `str`
        Username to  signup with.
    password: `str`
        Password to signup with.
    Returns
    -------
    FileSystemPage
        On user home directory.
    """
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup(username, password)
        filesystem_page.click_on_file(filesystem_page.username)
        yield filesystem_page

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

    def double_click(self, elem):
        """
        Double click action on elem.

        Parameters
        ----------
        elem: `WebElement`
            The WebElement to be double clicked on.
        """
        a_chain = ActionChains(self.d)
        a_chain.double_click(elem).perform()
        return FileSystemPage(self.d)

    def context_click(self, elem):
        """
        Context  click action on elem.

        Parameters
        ----------
        elem: `WebElement`
            The WebElement to be double clicked on.
        """
        a_chain = ActionChains(self.d)
        a_chain.context_click(elem).perform()

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
            username = guid()
        if password is None:
            password = guid()

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

    def click_on_file(self, filename):
        self.d.find_element_by_id(filename).click()
        return FileSystemPage(self.d, self.username,  self.password)

    def double_click_on_file(self, filename):
        """
        Double click the file/folder by name.

        Returns
        -------
        FileSystemPage
            The filesystem after  clicking on filename.
        """
        elem = self.d.find_element_by_id(filename)
        self.double_click(elem)
        return FileSystemPage(self.d)

    def context_click_on_file(self, filename):
        elem = self.d.find_element_by_id(filename)
        self.context_click(elem)
        return FileSystemPage(self.d, self.username, self.password)

    def delete_file(self, filename):
        """delete file in current directory."""
        self.context_click_on_file(filename)
        self.d.find_element_by_id('delete-file').click()
        return FileSystemPage(self.d, self.username, self.password)

    def public_link(self, filename):
        """open the context menu for filename and click the public-link option."""
        self.context_click_on_file(filename)
        self.d.find_element_by_id('public-link-file').click()
        return FileSystemPage(self.d,  self.username, self.password)

    def mkdir(self, folder_name):
        """
        Click mkdir button.

        Parameters
        ----------
        folder_name: str
            Send keys  after  clicking mkdir.

        Returns
        -------
        FileSystemPage
            After confirming mkdir.
        """
        self.get_unique_xpath("//li[@id='mkdirButton']").click()
        self.d.find_element_by_id('prompt-input').send_keys(folder_name)
        self.d.find_element_by_id('prompt-button-id').click()
        return FileSystemPage(self.d, self.username, self.password)

    def rename(self, current_name, new_name):
        """
        Rename a file/folder.

        Parameters
        ----------
        current_name: `str`
        new_name: `str`

        Returns
        -------
        FileSystemPage
            After confirming rename.
        """
        self.context_click_on_file(current_name)
        self.d.find_element_by_id('rename-file').click()
        self.d.find_element_by_id('prompt-input').send_keys(new_name)
        self.d.find_element_by_id('prompt-button-id').click()
        return FileSystemPage(self.d, self.username, self.password)

    def upload_file(self, file_path):
        """
        Upload local file to Peergos by clicking upload button.
        """
        # elem = self.get_unique_xpath("//li[@id='uploadButton']")
        elem = self.get_unique_xpath("//li[@id='uploadInput']")
        # print("elem", elem)
        # elem.click()
        # dialog = self.d.switch_to_alert()
        dialog = elem
        dialog.send_keys(file_path)
        dialog.send_keys(Keys.RETURN)
        return FileSystemPage(self.d, self.username, self.password)

    @classmethod
    def _init_sleep(cls):
        return 5

    def _open_social(self):
        self.d.find_element_by_id('sharingOptionsSpan').click()

    def send_follow_request(self, to_friend):
        """Send a friend request to another user."""
        self._open_social()
        self.d.find_element_by_id('friend-name-input').send_keys(to_friend)
        self.d.find_element_by_id('send-follow-request-id').click()
    def get_pending_follow_request(self):
        """Get a list of the  usernames for which you have pending users-follow-requests."""
        self._open_social()
        table = self.d.find_element_by_id('follow-request-table-id')
        request_elems = table.find_elements_by_xpath("//td[contains(@id,'follow-request-id')]")
        return [e.get_attribute('id') for e  in request_elems]

    def accept_follow_request(self, from_user):
        """Accept a pending follow request from a user."""
        pass

