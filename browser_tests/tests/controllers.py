import collections
import abc
import attr
import time
import sys
import uuid 

from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from contextlib import contextmanager

class PeergosError(Exception):
    """Package root exception."""
    pass

def _guid():
    """Returns a random guid string."""
    return str(uuid.uuid4())


def get_driver():
    """Returns a webdriver."""
    return webdriver.Firefox()

def get_driver_on_page(url):
    """Creates a  webdriver and navigates it to url."""
    driver = get_driver()
    driver.get(url)
    return driver


class Page(object):
    '''A controller for interacting  with a `page` on the Peergos web-app.'''  

    __metaclass__ = abc.ABCMeta

    def __init__(self, driver):
        self.driver = driver
        time.sleep(self._init_sleep())
        if not self._is_valid():
            raise PeergosError("invalid page "+ str(self.__class__))

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

class LandingPage(Page):
    """The landing page."""
    def _is_valid(self):
        self.get_unique_xpath("//h2[text()='Please log in']")
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

class SignupPage(Page):
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
    def __init__(self, driver, username, password):
        super(FileSystemPage, self).__init__(driver)
        self.username = username
        self.password = password
    def _is_valid(self):
        self.get_unique_xpath("//button[@id='logoutButton']")
        return True

    @classmethod
    def _init_sleep(cls):
        return 5 

