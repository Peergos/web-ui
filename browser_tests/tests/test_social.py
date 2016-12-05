import pytest
from controllers import *



def test_send_follow_request_to_nonexistent_user_fails():
    users = [guid(), guid()]
    sender, receiver = users

    with signup_to_homedir(username=sender, password=sender) as filesystem:
            # must fail since receiver doesn't exist
            filesystem.send_follow_request(receiver)
            follow_request_sent = filesystem.d.find_elements_by_xpath("//h3[text()='{}']".format('Follow request sent!'))
            assert len(follow_request_sent) == 0


def test_send_and_accept_follow_request():
    users = [guid(), guid()]

    # signup two users
    for user in users:
        with signup_to_homedir(username=user, password=user):
            pass

    sender, receiver = users
    print('sender, receiver', users)
    # send follow request from sender to receiver
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        filesystem = landing_page.login(sender, sender)
        filesystem.send_follow_request(receiver)

    with driver_context() as driver:
        landing_page = LoginPage(driver)
        filesystem = landing_page.login(receiver, receiver)
        pending_follow_requests = filesystem.get_pending_follow_request()
        filesystem.go_home()
        # receiver has pending follow request  from sender
        assert pending_follow_requests == [sender]
        filesystem.accept_follow_request(sender)





def test_send_and_accept_and_reciprocate_follow_request():
    pass

def test_send_and_deny_follow_request():
    pass


def test_share_folder():
    pass